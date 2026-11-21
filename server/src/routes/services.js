import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireRole, requireStaff } from '../auth.js';
import { HttpError, forbidden, notFound } from '../errors.js';
import { logAudit } from '../audit.js';
import { sendWhatsAppMessage } from '../whatsapp.js';
import { emitToPatient, emitToUser } from '../realtime.js';

const router = Router();

const emptyToNull = (v) => (v === '' ? null : v);

const serviceSchema = z.object({
  code: z.string().trim().min(2).max(50),
  category: z.enum(['TELEPHARMACY', 'PTO', 'COUNSELING', 'RECONCILIATION', 'HOME_CARE']).default('TELEPHARMACY'),
  nameId: z.string().trim().min(2).max(200),
  nameEn: z.string().trim().min(2).max(200),
  descriptionId: z.string().trim().min(5).max(2000),
  descriptionEn: z.string().trim().min(5).max(2000),
  durationMinutes: z.coerce.number().int().min(5).max(240).default(30),
  priceIDR: z.coerce.number().int().min(0).default(0),
  icon: z.string().trim().max(50).default('Stethoscope'),
  active: z.boolean().default(true),
});

// List pharmacy services & verified pharmacists
router.get('/', async (req, res) => {
  const showAll = req.query.all === '1' && isStaff(req.user);
  const [services, pharmacists] = await Promise.all([
    prisma.pharmacyService.findMany({
      where: showAll ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { requests: true } } },
    }),
    prisma.user.findMany({
      where: {
        role: 'PHARMACIST',
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        pharmacistProfile: true,
        _count: { select: { assignedPatients: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  res.json({ services, pharmacists });
});

router.post('/', requireStaff, async (req, res) => {
  const data = serviceSchema.parse(req.body);
  const service = await prisma.pharmacyService.create({ data });
  await logAudit(req.user, 'CREATE_SERVICE', 'PharmacyService', service.id, { code: service.code, nameId: service.nameId });
  res.status(201).json({ service });
});

router.patch('/:id', requireStaff, async (req, res) => {
  const existing = await prisma.pharmacyService.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Service not found');
  const data = serviceSchema.partial().parse(req.body);
  const service = await prisma.pharmacyService.update({
    where: { id: existing.id },
    data,
  });
  await logAudit(req.user, 'UPDATE_SERVICE', 'PharmacyService', service.id, data);
  res.json({ service });
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const existing = await prisma.pharmacyService.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Service not found');
  await prisma.pharmacyService.delete({ where: { id: existing.id } });
  await logAudit(req.user, 'DELETE_SERVICE', 'PharmacyService', existing.id, { code: existing.code });
  res.json({ ok: true });
});

// ---- Service Requests (Bookings / Consultations) --------------------------

router.get('/requests', async (req, res) => {
  const where = {};
  if (!isStaff(req.user)) {
    if (!req.user.patient) throw forbidden();
    where.patientId = req.user.patient.id;
  } else {
    if (req.query.status) where.status = req.query.status;
    if (req.query.mine === '1') where.pharmacistId = req.user.id;
  }

  const requests = await prisma.serviceRequest.findMany({
    where,
    include: {
      service: true,
      patient: {
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, locale: true } },
        },
      },
      pharmacist: {
        select: { id: true, name: true, phone: true, pharmacistProfile: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({ requests });
});

const createRequestSchema = z.object({
  serviceId: z.string().min(1),
  pharmacistId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  preferredDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  complaint: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
});

router.post('/requests', async (req, res) => {
  if (!req.user.patient) throw new HttpError(400, 'Only patients can book pharmacy services');
  const data = createRequestSchema.parse(req.body);
  const service = await prisma.pharmacyService.findUnique({ where: { id: data.serviceId } });
  if (!service || !service.active) throw notFound('Pharmacy service not found');

  const preferredDate = data.preferredDate ? new Date(data.preferredDate) : null;
  const pharmacistId = data.pharmacistId || req.user.patient.pharmacistId || null;

  const requestRecord = await prisma.serviceRequest.create({
    data: {
      patientId: req.user.patient.id,
      serviceId: service.id,
      pharmacistId,
      preferredDate: preferredDate && !Number.isNaN(+preferredDate) ? preferredDate : null,
      complaint: data.complaint || null,
      status: 'PENDING',
    },
    include: {
      service: true,
      pharmacist: { select: { id: true, name: true, phone: true } },
    },
  });

  // Also post an automatic notification in the patient's consultation thread
  const msgBody =
    req.user.locale === 'en'
      ? `[Service Request: ${service.nameEn}] ${data.complaint ? `Complaint/Notes: ${data.complaint}` : 'Requested pharmacy service consultation.'}`
      : `[Permintaan Layanan: ${service.nameId}] ${data.complaint ? `Keluhan/Catatan: ${data.complaint}` : 'Mengajukan permintaan layanan kefarmasian.'}`;

  await prisma.message.create({
    data: {
      patientId: req.user.patient.id,
      senderId: req.user.id,
      body: msgBody,
    },
  });

  if (pharmacistId) {
    emitToUser(pharmacistId, 'service:requested', requestRecord);
  }

  res.status(201).json({ request: requestRecord });
});

const updateRequestSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  pharmacistId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  pharmacistReply: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  notifyWhatsApp: z.boolean().optional(),
});

router.patch('/requests/:id', requireStaff, async (req, res) => {
  const existing = await prisma.serviceRequest.findUnique({
    where: { id: req.params.id },
    include: {
      service: true,
      patient: { include: { user: true } },
    },
  });
  if (!existing) throw notFound('Service request not found');

  const data = updateRequestSchema.parse(req.body);
  const updated = await prisma.serviceRequest.update({
    where: { id: existing.id },
    data: {
      status: data.status ?? existing.status,
      pharmacistId: data.pharmacistId !== undefined ? data.pharmacistId : existing.pharmacistId || req.user.id,
      pharmacistReply: data.pharmacistReply !== undefined ? data.pharmacistReply : existing.pharmacistReply,
    },
    include: {
      service: true,
      patient: { include: { user: { select: { id: true, name: true, phone: true, email: true, locale: true } } } },
      pharmacist: { select: { id: true, name: true, phone: true, pharmacistProfile: true } },
    },
  });

  if (data.pharmacistReply) {
    await prisma.message.create({
      data: {
        patientId: existing.patientId,
        senderId: req.user.id,
        body: `[${existing.service.nameId} — ${updated.status}] ${data.pharmacistReply}`,
      },
    });
  }

  if (data.notifyWhatsApp && existing.patient.user.phone) {
    const waText =
      existing.patient.user.locale === 'en'
        ? `[Apoteku Pharmacy Service] Hello ${existing.patient.user.name}, your request for *${existing.service.nameEn}* is now *${updated.status}*.${data.pharmacistReply ? ` Pharmacist note: ${data.pharmacistReply}` : ''}`
        : `[Layanan Farmasi Apoteku] Halo ${existing.patient.user.name}, permintaan layanan *${existing.service.nameId}* Anda berstatus *${updated.status}*.${data.pharmacistReply ? ` Catatan Apoteker (${req.user.name}): ${data.pharmacistReply}` : ''}`;
    await sendWhatsAppMessage({
      phone: existing.patient.user.phone,
      message: waText,
      category: 'CONSULTATION',
      userId: existing.patient.userId,
      patientId: existing.patientId,
    });
  }

  emitToPatient(existing.patientId, 'service:updated', updated);
  await logAudit(req.user, 'UPDATE_SERVICE_REQUEST', 'ServiceRequest', updated.id, { status: updated.status });

  res.json({ request: updated });
});

export default router;

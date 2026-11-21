import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, publicUser, requireStaff, resolvePatient } from '../auth.js';
import { HttpError } from '../errors.js';
import { adherenceFor, adherenceRates, rematerializePatient } from '../doses.js';
import { isValidDate, isValidTimezone, startOfLocalDay } from '../time.js';
import { normalizePhone } from './auth.js';
import { classifyBloodPressure, isControlled } from '../bloodPressure.js';

const router = Router();

const emptyToNull = (v) => (v === '' ? null : v);
const optText = (max = 2000) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const profileFields = {
  dateOfBirth: z.preprocess(emptyToNull, z.string().refine(isValidDate, 'Invalid date').nullable().optional()),
  gender: z.preprocess(emptyToNull, z.enum(['MALE', 'FEMALE']).nullable().optional()),
  address: optText(500),
  diagnosis: optText(500),
  allergies: optText(500),
  estimatedDueDate: z.preprocess(emptyToNull, z.string().refine(isValidDate, 'Invalid date').nullable().optional()),
  riskFactors: optText(1000),
};

const staffFields = {
  ...profileFields,
  notes: optText(5000),
  studyCode: optText(50),
  pharmacistId: z.preprocess(emptyToNull, z.string().nullable().optional()),
  estimatedDueDate: z.preprocess(emptyToNull, z.string().refine(isValidDate, 'Invalid date').nullable().optional()),
  riskFactors: optText(1000),
  studyGroup: z.enum(['INTERVENTION', 'CONTROL']).optional(),
  baselineSystolic: z.preprocess(emptyToNull, z.coerce.number().int().min(60).max(260).nullable().optional()),
  baselineDiastolic: z.preprocess(emptyToNull, z.coerce.number().int().min(30).max(160).nullable().optional()),
};

const userFields = {
  name: z.string().trim().min(2).max(100).optional(),
  email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().min(8).max(20).nullable().optional()),
  timezone: z.string().refine(isValidTimezone).optional(),
  locale: z.enum(['id', 'en']).optional(),
};

const toProfileData = (d, tz) => {
  const out = {};
  for (const k of [
    'gender', 'address', 'diagnosis', 'allergies', 'notes', 'studyCode', 'pharmacistId',
    'riskFactors', 'studyGroup', 'baselineSystolic', 'baselineDiastolic',
  ]) {
    if (d[k] !== undefined) out[k] = d[k];
  }
  if (d.dateOfBirth !== undefined) out.dateOfBirth = d.dateOfBirth ? startOfLocalDay(d.dateOfBirth, tz) : null;
  if (d.estimatedDueDate !== undefined) {
    out.estimatedDueDate = d.estimatedDueDate ? startOfLocalDay(d.estimatedDueDate, tz) : null;
  }
  return out;
};

const toUserData = (d) => {
  const out = {};
  for (const k of ['name', 'email', 'timezone', 'locale']) if (d[k] !== undefined) out[k] = d[k];
  if (d.phone !== undefined) out.phone = d.phone ? normalizePhone(d.phone) : null;
  return out;
};

const patientInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, locale: true, timezone: true, whatsappOptIn: true, active: true, createdAt: true } },
  pharmacist: { select: { id: true, name: true, phone: true, email: true, pharmacistProfile: true } },
};

const serializePatient = (p, viewer) => {
  const out = { ...p };
  if (!isStaff(viewer)) delete out.notes;
  return out;
};

// ---- Staff: list & enroll ------------------------------------------------

router.get('/', requireStaff, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = q
    ? {
        OR: [
          { user: { name: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q } } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { studyCode: { contains: q, mode: 'insensitive' } },
          { diagnosis: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};
  if (req.query.mine === '1') where.pharmacistId = req.user.id;

  const patients = await prisma.patient.findMany({
    where,
    include: { ...patientInclude, _count: { select: { medications: { where: { active: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const ids = patients.map((p) => p.id);
  const userIds = patients.map((p) => p.userId);

  const [rate7, rate30, unread, lastMessages, bloodPressures] = await Promise.all([
    adherenceRates(ids, 7),
    adherenceRates(ids, 30),
    prisma.message.groupBy({
      by: ['patientId'],
      where: { patientId: { in: ids }, readAt: null, senderId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.message.groupBy({ by: ['patientId'], where: { patientId: { in: ids } }, _max: { createdAt: true } }),
    prisma.bloodPressureLog.findMany({
      where: {
        patientId: { in: ids },
        measuredAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
      select: { patientId: true, systolic: true, diastolic: true, measuredAt: true },
      orderBy: { measuredAt: 'desc' },
    }),
  ]);
  const unreadMap = Object.fromEntries(unread.map((u) => [u.patientId, u._count._all]));
  const lastMap = Object.fromEntries(lastMessages.map((m) => [m.patientId, m._max.createdAt]));
  const bpByPatient = new Map();
  for (const bp of bloodPressures) {
    if (!bpByPatient.has(bp.patientId)) bpByPatient.set(bp.patientId, []);
    bpByPatient.get(bp.patientId).push(bp);
  }

  res.json({
    patients: patients.map((p) => {
      const logs = bpByPatient.get(p.id) || [];
      const latest = logs[0] || null;
      return {
        ...p,
        activeMedications: p._count.medications,
        adherence7: rate7[p.id],
        adherence30: rate30[p.id],
        unread: unreadMap[p.id] || 0,
        lastMessageAt: lastMap[p.id] || null,
        latestBloodPressure: latest
          ? {
              systolic: latest.systolic,
              diastolic: latest.diastolic,
              measuredAt: latest.measuredAt,
              category: classifyBloodPressure(latest.systolic, latest.diastolic),
            }
          : null,
        bloodPressureControlRate: logs.length
          ? Math.round((logs.filter(isControlled).length / logs.length) * 100)
          : null,
      };
    }),
  });
});

const createSchema = z
  .object({
    ...userFields,
    name: z.string().trim().min(2).max(100),
    password: z.string().min(6).max(100),
    consentAccepted: z.literal(true),
    ...staffFields,
  })
  .refine((d) => d.email || d.phone, { message: 'Email or phone is required', path: ['email'] });

router.post('/', requireStaff, async (req, res) => {
  const d = createSchema.parse(req.body);
  const tz = d.timezone || 'Asia/Jakarta';
  const user = await prisma.user.create({
    data: {
      ...toUserData(d),
      role: 'PATIENT',
      passwordHash: await bcrypt.hash(d.password, 10),
      patient: { create: { pharmacistId: req.user.id, consentedAt: new Date(), ...toProfileData(d, tz) } },
    },
    include: { patient: true },
  });
  res.status(201).json({ patient: user.patient, user: publicUser(user) });
});

// ---- Single patient ("me" or id) ------------------------------------------

router.get('/:patientId', resolvePatient, async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.patient.id }, include: patientInclude });
  res.json({ patient: serializePatient(patient, req.user) });
});

router.patch('/:patientId', resolvePatient, async (req, res) => {
  const staff = isStaff(req.user);
  const schema = z.object(staff ? { ...userFields, ...staffFields } : profileFields);
  const d = schema.parse(req.body);
  const tz = d.timezone || req.patient.user.timezone;

  if (staff && d.pharmacistId) {
    const ph = await prisma.user.findFirst({ where: { id: d.pharmacistId, role: { in: ['PHARMACIST', 'ADMIN'] } } });
    if (!ph) throw new HttpError(400, 'Unknown pharmacist');
  }

  await prisma.$transaction(async (tx) => {
    if (staff) {
      const userData = toUserData(d);
      if (Object.keys(userData).length) await tx.user.update({ where: { id: req.patient.userId }, data: userData });
    }
    await tx.patient.update({ where: { id: req.patient.id }, data: toProfileData(d, tz) });
  });

  if (staff && d.timezone && d.timezone !== req.patient.user.timezone) await rematerializePatient(req.patient.id);

  const patient = await prisma.patient.findUnique({ where: { id: req.patient.id }, include: patientInclude });
  res.json({ patient: serializePatient(patient, req.user) });
});

router.post('/:patientId/reset-password', requireStaff, resolvePatient, async (req, res) => {
  const { password } = z.object({ password: z.string().min(6).max(100) }).parse(req.body);
  await prisma.user.update({ where: { id: req.patient.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  res.json({ ok: true });
});

router.get('/:patientId/adherence', resolvePatient, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  res.json(await adherenceFor(req.patient.id, req.patient.user.timezone, days));
});

export default router;

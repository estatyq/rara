import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireStaff, resolvePatient } from '../auth.js';
import { HttpError, notFound } from '../errors.js';
import { classifyBloodPressure, isControlled, summarizeBloodPressures } from '../bloodPressure.js';
import { emitToPatient } from '../realtime.js';
import { sendPushToUsers } from '../push.js';
import { addDays, localDate, startOfLocalDay } from '../time.js';
import { sendWhatsAppMessage } from '../whatsapp.js';

export const patientScoped = Router({ mergeParams: true });
export const flat = Router();

const emptyToNull = (value) => (value === '' ? null : value);

const bloodPressureSchema = z.object({
  systolic: z.coerce.number().int().min(60).max(260),
  diastolic: z.coerce.number().int().min(30).max(160),
  pulse: z.preprocess(emptyToNull, z.coerce.number().int().min(30).max(220).nullable().optional()),
  measuredAt: z.string().datetime().optional(),
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  source: z.enum(['SELF', 'CLINIC']).optional(),
});

patientScoped.get('/blood-pressure', resolvePatient, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
  const from = addDays(localDate(req.patient.user.timezone), -(days - 1));
  const logs = await prisma.bloodPressureLog.findMany({
    where: {
      patientId: req.patient.id,
      measuredAt: { gte: startOfLocalDay(from, req.patient.user.timezone) },
    },
    orderBy: { measuredAt: 'desc' },
    take: limit,
  });
  res.json({
    logs: logs.map((log) => ({
      ...log,
      category: classifyBloodPressure(log.systolic, log.diastolic),
      controlled: isControlled(log),
    })),
    summary: summarizeBloodPressures(logs, days),
  });
});

patientScoped.post('/blood-pressure', resolvePatient, async (req, res) => {
  const data = bloodPressureSchema.parse(req.body);
  if (data.systolic <= data.diastolic) {
    throw new HttpError(400, 'Systolic pressure must be higher than diastolic pressure');
  }

  const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
  if (measuredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new HttpError(400, 'Measurement time cannot be in the future');
  }

  const log = await prisma.bloodPressureLog.create({
    data: {
      patientId: req.patient.id,
      systolic: data.systolic,
      diastolic: data.diastolic,
      pulse: data.pulse ?? null,
      measuredAt,
      note: data.note ?? null,
      source: isStaff(req.user) ? (data.source || 'CLINIC') : 'SELF',
    },
  });
  const enriched = {
    ...log,
    category: classifyBloodPressure(log.systolic, log.diastolic),
    controlled: isControlled(log),
  };

  emitToPatient(req.patient.id, 'blood-pressure:changed', enriched);

  if (enriched.category === 'CRITICAL' || enriched.category === 'HIGH') {
    const recipients = req.patient.pharmacistId
      ? [req.patient.pharmacistId]
      : (await prisma.user.findMany({
          where: { role: { in: ['PHARMACIST', 'ADMIN'] }, active: true },
          select: { id: true },
        })).map((user) => user.id);
    if (enriched.category === 'CRITICAL') {
      sendPushToUsers(recipients, {
        title: 'Pemantauan tekanan darah',
        body: `${req.patient.studyCode || 'Pasien'}: ${log.systolic}/${log.diastolic} mmHg. Tinjau hasil pengukuran.`,
        url: `/staff/patients/${req.patient.id}`,
        tag: `bp-${req.patient.id}`,
      }).catch(() => {});
    }

    const pUser = await prisma.user.findUnique({ where: { id: req.patient.userId } });
    if (pUser?.phone && pUser?.whatsappOptIn) {
      const waMsg =
        pUser.locale === 'en'
          ? `[Apoteku BP Alert] Hello ${pUser.name}, your blood pressure reading of *${log.systolic}/${log.diastolic} mmHg* is classified as *${enriched.category}*. ${enriched.category === 'CRITICAL' ? 'Please seek immediate medical evaluation or contact your clinical pharmacist.' : 'Please rest, re-measure in 15 minutes, and consult your pharmacist.'}`
          : `[Peringatan Tekanan Darah Apoteku] Halo ${pUser.name}, hasil pengukuran tekanan darah Anda *${log.systolic}/${log.diastolic} mmHg* termasuk kategori *${enriched.category === 'CRITICAL' ? 'KRITIS' : 'TINGGI'}*. ${enriched.category === 'CRITICAL' ? 'Segera hubungi fasilitas kesehatan atau apoteker Anda bila disertai keluhan.' : 'Silakan istirahat tenang dan konsultasikan dengan apoteker Anda.'}`;
      sendWhatsAppMessage({
        phone: pUser.phone,
        message: waMsg,
        category: 'BP_ALERT',
        userId: pUser.id,
        patientId: req.patient.id,
      }).catch(() => {});
    }
  }

  res.status(201).json({ log: enriched });
});

flat.delete('/blood-pressure/:id', requireStaff, async (req, res) => {
  const existing = await prisma.bloodPressureLog.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Blood pressure record not found');
  await prisma.bloodPressureLog.delete({ where: { id: existing.id } });
  emitToPatient(existing.patientId, 'blood-pressure:changed', { deletedId: existing.id });
  res.json({ ok: true });
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, resolvePatient } from '../auth.js';
import { HttpError, forbidden, notFound } from '../errors.js';
import { addDays, localDate, startOfLocalDay } from '../time.js';
import { emitToPatient } from '../realtime.js';

export const patientScoped = Router({ mergeParams: true });
export const flat = Router();

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const ALLOWED_PARAM_TYPES = [
  'WEIGHT',
  'BLOOD_GLUCOSE',
  'HEART_RATE',
  'SPO2',
  'TEMPERATURE',
  'EDEMA',
  'URINE_PROTEIN',
  'FETAL_MOVEMENT',
];

const DEFAULT_UNITS = {
  WEIGHT: 'kg',
  BLOOD_GLUCOSE: 'mg/dL',
  HEART_RATE: 'bpm',
  SPO2: '%',
  TEMPERATURE: '°C',
  EDEMA: 'grade',
  URINE_PROTEIN: '+',
  FETAL_MOVEMENT: 'kicks/2h',
};

const healthParamSchema = z.object({
  type: z.enum(ALLOWED_PARAM_TYPES),
  value: z.coerce.number().finite().min(0).max(1000),
  unit: z.preprocess(emptyToNull, z.string().trim().max(30).nullable().optional()),
  context: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  measuredAt: z.string().datetime().optional(),
  source: z.enum(['SELF', 'CLINIC']).optional(),
});

// ---- Health Parameters (Weight, SpO2, Temp, Heart Rate, Edema, Fetal Movement, Glucose) ----

patientScoped.get('/health-parameters', resolvePatient, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 60, 1), 365);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
  const type = req.query.type && ALLOWED_PARAM_TYPES.includes(String(req.query.type))
    ? String(req.query.type)
    : undefined;

  const from = addDays(localDate(req.patient.user.timezone), -(days - 1));
  const logs = await prisma.healthParameterLog.findMany({
    where: {
      patientId: req.patient.id,
      ...(type ? { type } : {}),
      measuredAt: { gte: startOfLocalDay(from, req.patient.user.timezone) },
    },
    orderBy: { measuredAt: 'desc' },
    take: limit,
  });

  // Compute latest per parameter type for summary cards
  const latestByType = {};
  for (const log of logs) {
    if (!latestByType[log.type]) {
      latestByType[log.type] = log;
    }
  }

  res.json({ logs, latestByType, days });
});

patientScoped.post('/health-parameters', resolvePatient, async (req, res) => {
  const data = healthParamSchema.parse(req.body);
  const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
  if (measuredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new HttpError(400, 'Measurement time cannot be in the future');
  }

  const log = await prisma.healthParameterLog.create({
    data: {
      patientId: req.patient.id,
      type: data.type,
      value: data.value,
      unit: data.unit || DEFAULT_UNITS[data.type] || '',
      context: data.context ?? null,
      note: data.note ?? null,
      source: isStaff(req.user) ? (data.source || 'CLINIC') : 'SELF',
      measuredAt,
    },
  });

  emitToPatient(req.patient.id, 'health-parameter:changed', log);
  res.status(201).json({ log });
});

flat.delete('/health-parameters/:id', async (req, res) => {
  const existing = await prisma.healthParameterLog.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Health parameter record not found');
  if (!isStaff(req.user) && existing.patientId !== req.user.patient?.id) throw forbidden();
  await prisma.healthParameterLog.delete({ where: { id: existing.id } });
  emitToPatient(existing.patientId, 'health-parameter:changed', { deletedId: existing.id });
  res.json({ ok: true });
});

// ---- Follow-Up & Check-Up Reminders ----------------------------------------

const checkupSchema = z.object({
  title: z.string().trim().min(2).max(200),
  type: z.enum(['CHECKUP', 'FOLLOW_UP', 'LAB_TEST', 'REFILL']).default('CHECKUP'),
  scheduledAt: z.string().min(4),
  location: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
});

const updateCheckupSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  type: z.enum(['CHECKUP', 'FOLLOW_UP', 'LAB_TEST', 'REFILL']).optional(),
  scheduledAt: z.string().min(4).optional(),
  location: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  status: z.enum(['UPCOMING', 'COMPLETED', 'CANCELLED']).optional(),
});

patientScoped.get('/checkups', resolvePatient, async (req, res) => {
  const reminders = await prisma.checkupReminder.findMany({
    where: { patientId: req.patient.id },
    orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
    take: 100,
  });
  res.json({ reminders });
});

patientScoped.post('/checkups', resolvePatient, async (req, res) => {
  const data = checkupSchema.parse(req.body);
  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(+scheduledAt)) {
    throw new HttpError(400, 'Invalid scheduledAt date');
  }
  const reminder = await prisma.checkupReminder.create({
    data: {
      patientId: req.patient.id,
      createdById: req.user.id,
      title: data.title,
      type: data.type,
      scheduledAt,
      location: data.location ?? null,
      notes: data.notes ?? null,
      status: 'UPCOMING',
    },
  });
  emitToPatient(req.patient.id, 'checkup:changed', reminder);
  res.status(201).json({ reminder });
});

flat.patch('/checkups/:id', async (req, res) => {
  const existing = await prisma.checkupReminder.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Check-up reminder not found');
  if (!isStaff(req.user) && existing.patientId !== req.user.patient?.id) throw forbidden();

  const data = updateCheckupSchema.parse(req.body);
  const update = {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.location !== undefined ? { location: data.location } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
  };
  if (data.scheduledAt) {
    const parsed = new Date(data.scheduledAt);
    if (Number.isNaN(+parsed)) throw new HttpError(400, 'Invalid scheduledAt date');
    update.scheduledAt = parsed;
    update.remindedAt = null;
  }

  const reminder = await prisma.checkupReminder.update({
    where: { id: existing.id },
    data: update,
  });
  emitToPatient(existing.patientId, 'checkup:changed', reminder);
  res.json({ reminder });
});

flat.delete('/checkups/:id', async (req, res) => {
  const existing = await prisma.checkupReminder.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Check-up reminder not found');
  if (!isStaff(req.user) && existing.patientId !== req.user.patient?.id) throw forbidden();
  await prisma.checkupReminder.delete({ where: { id: existing.id } });
  emitToPatient(existing.patientId, 'checkup:changed', { deletedId: existing.id });
  res.json({ ok: true });
});

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, isStaff, resolvePatient, verifyDoseToken } from '../auth.js';
import { HttpError, forbidden, notFound } from '../errors.js';
import { rematerializeMedication } from '../doses.js';
import { addDays, endOfLocalDay, isValidDate, isValidTime, localDate, startOfLocalDay } from '../time.js';
import { emitToPatient } from '../realtime.js';

// Routes mounted under /api/patients/:patientId
export const patientScoped = Router({ mergeParams: true });
// Routes mounted under /api
export const flat = Router();

const emptyToNull = (v) => (v === '' ? null : v);

const medSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dosage: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  form: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  instructions: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  times: z
    .array(z.string().refine(isValidTime, 'Time must be HH:mm'))
    .max(12)
    .transform((a) => [...new Set(a)].sort()),
  startDate: z.preprocess(emptyToNull, z.string().refine(isValidDate).nullable().optional()),
  endDate: z.preprocess(emptyToNull, z.string().refine(isValidDate).nullable().optional()),
  active: z.boolean().optional(),
  articleId: z.preprocess(emptyToNull, z.string().nullable().optional()),
});

const toMedData = (d, tz) => {
  const out = { ...d };
  if (d.startDate !== undefined) out.startDate = d.startDate ? startOfLocalDay(d.startDate, tz) : undefined;
  if (d.endDate !== undefined) out.endDate = d.endDate ? endOfLocalDay(d.endDate, tz) : null;
  if (out.startDate === undefined) delete out.startDate;
  return out;
};

const medInclude = { article: { select: { id: true, slug: true, titleId: true, titleEn: true } } };

async function loadMedication(req) {
  const med = await prisma.medication.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: { timezone: true } } } } },
  });
  if (!med) throw notFound('Medication not found');
  if (!isStaff(req.user) && med.patientId !== req.user.patient?.id) throw forbidden();
  return med;
}

// ---- Medications ----------------------------------------------------------

patientScoped.get('/medications', resolvePatient, async (req, res) => {
  const where = { patientId: req.patient.id };
  if (req.query.all !== '1') where.active = true;
  const medications = await prisma.medication.findMany({ where, include: medInclude, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
  res.json({ medications });
});

patientScoped.post('/medications', resolvePatient, async (req, res) => {
  const d = medSchema.parse(req.body);
  const med = await prisma.medication.create({
    data: { ...toMedData(d, req.patient.user.timezone), patientId: req.patient.id, createdById: req.user.id },
    include: medInclude,
  });
  await rematerializeMedication(med.id);
  emitToPatient(req.patient.id, 'medications:changed', { patientId: req.patient.id });
  res.status(201).json({ medication: med });
});

flat.patch('/medications/:id', authenticate, async (req, res) => {
  const existing = await loadMedication(req);
  const d = medSchema.partial().parse(req.body);
  const med = await prisma.medication.update({
    where: { id: existing.id },
    data: toMedData(d, existing.patient.user.timezone),
    include: medInclude,
  });
  await rematerializeMedication(med.id);
  emitToPatient(med.patientId, 'medications:changed', { patientId: med.patientId });
  res.json({ medication: med });
});

// Soft delete: keeps dose history for research
flat.delete('/medications/:id', authenticate, async (req, res) => {
  const existing = await loadMedication(req);
  await prisma.medication.update({ where: { id: existing.id }, data: { active: false, endDate: existing.endDate ?? new Date() } });
  await rematerializeMedication(existing.id);
  emitToPatient(existing.patientId, 'medications:changed', { patientId: existing.patientId });
  res.json({ ok: true });
});

// ---- Doses ----------------------------------------------------------------

patientScoped.get('/doses', resolvePatient, async (req, res) => {
  const tz = req.patient.user.timezone;
  const from = isValidDate(req.query.from) ? req.query.from : isValidDate(req.query.date) ? req.query.date : localDate(tz);
  let to = isValidDate(req.query.to) ? req.query.to : from;
  if (to < from) to = from;
  if (to > addDays(from, 366)) throw new HttpError(400, 'Range too large');

  const doses = await prisma.doseLog.findMany({
    where: { patientId: req.patient.id, scheduledAt: { gte: startOfLocalDay(from, tz), lte: endOfLocalDay(to, tz) } },
    include: { medication: { select: { id: true, name: true, dosage: true, form: true, instructions: true, active: true, articleId: true } } },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ timezone: tz, from, to, doses });
});

const MAX_EDIT_AGE_MS = 48 * 3600 * 1000;
const MAX_EARLY_MS = 12 * 3600 * 1000;

async function setDoseStatus(dose, status, note) {
  const now = Date.now();
  if (status !== 'PENDING') {
    if (now - +dose.scheduledAt > MAX_EDIT_AGE_MS) throw new HttpError(400, 'This dose is too old to change');
    if (+dose.scheduledAt - now > MAX_EARLY_MS) throw new HttpError(400, 'This dose is too far in the future');
  }
  const updated = await prisma.doseLog.update({
    where: { id: dose.id },
    data: {
      status,
      takenAt: status === 'TAKEN' ? new Date() : null,
      note: note === undefined ? undefined : note,
    },
    include: { medication: { select: { id: true, name: true, dosage: true, form: true, instructions: true, active: true, articleId: true } } },
  });
  emitToPatient(dose.patientId, 'dose:updated', updated);
  return updated;
}

const statusSchema = z.object({
  status: z.enum(['TAKEN', 'SKIPPED', 'PENDING']),
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
});

flat.patch('/doses/:id', authenticate, async (req, res) => {
  const { status, note } = statusSchema.parse(req.body);
  const dose = await prisma.doseLog.findUnique({ where: { id: req.params.id } });
  if (!dose) throw notFound('Dose not found');
  if (dose.patientId !== req.user.patient?.id && !isStaff(req.user)) throw forbidden();
  res.json({ dose: await setDoseStatus(dose, status, note) });
});

// Used by the service worker "Taken" notification action (no session available there).
flat.post('/doses/:id/quick', async (req, res) => {
  let payload;
  try {
    payload = verifyDoseToken(req.body?.token);
  } catch {
    throw new HttpError(401, 'Invalid token');
  }
  if (payload.dose !== req.params.id) throw forbidden();
  const dose = await prisma.doseLog.findUnique({ where: { id: req.params.id }, include: { patient: true } });
  if (!dose || dose.patient.userId !== payload.sub) throw notFound();
  if (dose.status === 'TAKEN') return res.json({ ok: true });
  await setDoseStatus(dose, 'TAKEN');
  res.json({ ok: true });
});

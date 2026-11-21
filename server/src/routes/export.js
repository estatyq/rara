import { Router } from 'express';
import { prisma } from '../db.js';
import { requireStaff } from '../auth.js';
import { notFound } from '../errors.js';
import { adherenceRates } from '../doses.js';
import { formatLocal } from '../time.js';
import { classifyBloodPressure, isControlled } from '../bloodPressure.js';

const router = Router();
router.use(requireStaff);

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function sendCsv(res, filename, header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 correctly
  res.send(`\uFEFF${lines.join('\r\n')}`);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const participant = (p, anon) => (anon ? [p.studyCode || p.id] : [p.studyCode || '', p.user.name]);
const participantHeader = (anon) => (anon ? ['participant'] : ['study_code', 'name']);
const ageOf = (dob) => (dob ? Math.floor((Date.now() - +dob) / (365.25 * 86400000)) : '');

router.get('/patients.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const patients = await prisma.patient.findMany({
    include: { user: true, pharmacist: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const ids = patients.map((p) => p.id);
  const [r7, r30, bloodPressures] = await Promise.all([
    adherenceRates(ids, 7),
    adherenceRates(ids, 30),
    prisma.bloodPressureLog.findMany({
      where: { patientId: { in: ids }, measuredAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { patientId: true, systolic: true, diastolic: true },
    }),
  ]);
  const bpByPatient = new Map();
  for (const bp of bloodPressures) {
    if (!bpByPatient.has(bp.patientId)) bpByPatient.set(bp.patientId, []);
    bpByPatient.get(bp.patientId).push(bp);
  }
  const header = [
    ...participantHeader(anon),
    ...(anon ? [] : ['email', 'phone', 'address', 'date_of_birth']),
    'age', 'gender', 'diagnosis', 'allergies', 'estimated_due_date', 'risk_factors', 'study_group',
    'baseline_systolic', 'baseline_diastolic', 'consented_at', 'pharmacist', 'timezone', 'enrolled_at',
    'adherence_7d_pct', 'adherence_30d_pct', 'bp_control_30d_pct',
  ];
  const rows = patients.map((p) => {
    const logs = bpByPatient.get(p.id) || [];
    return [
      ...participant(p, anon),
      ...(anon ? [] : [p.user.email, p.user.phone, p.address, p.dateOfBirth ? formatLocal(p.dateOfBirth, p.user.timezone, 'yyyy-MM-dd') : '']),
      ageOf(p.dateOfBirth), p.gender, p.diagnosis, p.allergies,
      p.estimatedDueDate ? formatLocal(p.estimatedDueDate, p.user.timezone, 'yyyy-MM-dd') : '',
      p.riskFactors, p.studyGroup, p.baselineSystolic, p.baselineDiastolic,
      p.consentedAt ? formatLocal(p.consentedAt, p.user.timezone) : '',
      p.pharmacist?.name, p.user.timezone, formatLocal(p.createdAt, p.user.timezone),
      r7[p.id], r30[p.id],
      logs.length ? Math.round((logs.filter(isControlled).length / logs.length) * 100) : '',
    ];
  });
  sendCsv(res, `patients-${stamp()}.csv`, header, rows);
});

router.get('/doses.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const where = { scheduledAt: { lte: new Date() } };
  if (req.query.from) where.scheduledAt.gte = new Date(req.query.from);
  if (req.query.to) where.scheduledAt.lte = new Date(`${req.query.to}T23:59:59Z`);
  const doses = await prisma.doseLog.findMany({
    where,
    include: { medication: true, patient: { include: { user: true } } },
    orderBy: [{ patientId: 'asc' }, { scheduledAt: 'asc' }],
  });
  const header = [...participantHeader(anon), 'medication', 'dosage', 'scheduled_local', 'status', 'taken_local', 'delay_minutes', 'reminded', 'note'];
  const rows = doses.map((d) => {
    const tz = d.patient.user.timezone;
    return [
      ...participant(d.patient, anon),
      d.medication.name, d.medication.dosage, formatLocal(d.scheduledAt, tz), d.status, formatLocal(d.takenAt, tz),
      d.takenAt ? Math.round((d.takenAt - d.scheduledAt) / 60000) : '', d.remindedAt ? 1 : 0, d.note,
    ];
  });
  sendCsv(res, `doses-${stamp()}.csv`, header, rows);
});

router.get('/responses.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const qid = req.query.questionnaireId?.toString();
  const questionnaire = qid ? await prisma.questionnaire.findUnique({ where: { id: qid } }) : null;
  if (qid && !questionnaire) throw notFound('Questionnaire not found');
  const responses = await prisma.questionnaireResponse.findMany({
    where: qid ? { questionnaireId: qid } : {},
    include: { questionnaire: true, patient: { include: { user: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const qIds = questionnaire ? questionnaire.questions.map((q) => q.id) : [];
  const header = [...participantHeader(anon), 'questionnaire', 'submitted_local', 'score', ...(questionnaire ? qIds : ['answers'])];
  const rows = responses.map((r) => [
    ...participant(r.patient, anon),
    r.questionnaire.code, formatLocal(r.createdAt, r.patient.user.timezone), r.score,
    ...(questionnaire ? qIds.map((id) => r.answers[id]) : [r.answers]),
  ]);
  sendCsv(res, `responses-${questionnaire?.code || 'all'}-${stamp()}.csv`, header, rows);
});

router.get('/messages.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const messages = await prisma.message.findMany({
    include: { sender: true, patient: { include: { user: true } } },
    orderBy: [{ patientId: 'asc' }, { createdAt: 'asc' }],
  });
  const header = [...participantHeader(anon), 'sent_local', 'sender_role', ...(anon ? [] : ['sender_name']), 'message'];
  const rows = messages.map((m) => [
    ...participant(m.patient, anon), formatLocal(m.createdAt, m.patient.user.timezone), m.sender.role,
    ...(anon ? [] : [m.sender.name]), m.body,
  ]);
  sendCsv(res, `messages-${stamp()}.csv`, header, rows);
});

router.get('/blood-pressure.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const where = {};
  if (req.query.from) where.measuredAt = { gte: new Date(req.query.from) };
  if (req.query.to) where.measuredAt = { ...(where.measuredAt || {}), lte: new Date(`${req.query.to}T23:59:59Z`) };
  const logs = await prisma.bloodPressureLog.findMany({
    where,
    include: { patient: { include: { user: true } } },
    orderBy: [{ patientId: 'asc' }, { measuredAt: 'asc' }],
  });
  const header = [
    ...participantHeader(anon),
    'measured_local',
    'systolic_mmhg',
    'diastolic_mmhg',
    'pulse_bpm',
    'mean_arterial_pressure',
    'controlled_lt_140_90',
    'classification',
    'source',
    'note',
  ];
  const rows = logs.map((log) => {
    const map = Math.round((log.systolic + 2 * log.diastolic) / 3);
    return [
      ...participant(log.patient, anon),
      formatLocal(log.measuredAt, log.patient.user.timezone),
      log.systolic,
      log.diastolic,
      log.pulse,
      map,
      isControlled(log) ? 1 : 0,
      classifyBloodPressure(log.systolic, log.diastolic),
      log.source,
      log.note,
    ];
  });
  sendCsv(res, `blood-pressure-${stamp()}.csv`, header, rows);
});

router.get('/follow-ups.csv', async (req, res) => {
  const anon = req.query.anonymize === '1';
  const records = await prisma.patientFollowUp.findMany({
    include: {
      patient: { include: { user: true } },
      pharmacist: { select: { name: true } },
    },
    orderBy: [{ patientId: 'asc' }, { createdAt: 'asc' }],
  });
  const header = [
    ...participantHeader(anon),
    'recorded_local',
    'type',
    'drp_category',
    'subjective',
    'objective',
    'assessment',
    'plan',
    'recommendation',
    'adherence_rate_pct',
    'latest_bp',
    'next_follow_up_date',
    'pharmacist',
  ];
  const rows = records.map((r) => {
    const tz = r.patient.user.timezone;
    return [
      ...participant(r.patient, anon),
      formatLocal(r.createdAt, tz),
      r.type,
      r.drpCategory,
      r.subjective,
      r.objective,
      r.assessment,
      r.plan,
      r.recommendation,
      r.adherenceRate,
      r.latestBp,
      r.nextFollowUpDate ? formatLocal(r.nextFollowUpDate, tz, 'yyyy-MM-dd') : '',
      r.pharmacist?.name,
    ];
  });
  sendCsv(res, `follow-ups-${stamp()}.csv`, header, rows);
});

export default router;

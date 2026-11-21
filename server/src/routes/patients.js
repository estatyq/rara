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
import { logAudit } from '../audit.js';
import { DateTime } from 'luxon';

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

// ---- Pharmacist Dashboard Analytics Summary (KPIs, At-Risk, Trend, Activity) ----

router.get('/dashboard-summary', requireStaff, async (req, res) => {
  const days = req.query.days === '30' ? 30 : 7;
  const mine = req.query.mine === '1';
  const tz = req.user.timezone || 'Asia/Jakarta';
  const startDt = DateTime.now().setZone(tz).startOf('day').minus({ days: days - 1 });
  const since = startDt.toJSDate();
  const now = new Date();

  const patientWhere = mine ? { pharmacistId: req.user.id } : {};
  const patients = await prisma.patient.findMany({
    where: patientWhere,
    include: {
      user: { select: { id: true, name: true, phone: true, active: true, timezone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const ids = patients.map((p) => p.id);
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const [
    rate30Map,
    doseLogsRange,
    bpLogsRange,
    recentDoses,
    recentBps,
    recentParams,
    recentMessages,
    pendingServices,
    upcomingCheckups,
  ] = await Promise.all([
    adherenceRates(ids, 30),
    ids.length
      ? prisma.doseLog.findMany({
          where: { patientId: { in: ids }, scheduledAt: { gte: since, lte: now } },
          select: { patientId: true, status: true, scheduledAt: true },
        })
      : [],
    ids.length
      ? prisma.bloodPressureLog.findMany({
          where: { patientId: { in: ids }, measuredAt: { gte: new Date(+now - 30 * 86400000) } },
          select: { patientId: true, systolic: true, diastolic: true, measuredAt: true },
          orderBy: { measuredAt: 'desc' },
        })
      : [],
    ids.length
      ? prisma.doseLog.findMany({
          where: { patientId: { in: ids }, status: { in: ['TAKEN', 'SKIPPED'] }, takenAt: { not: null } },
          include: { medication: { select: { name: true, dosage: true } } },
          orderBy: { takenAt: 'desc' },
          take: 10,
        })
      : [],
    ids.length
      ? prisma.bloodPressureLog.findMany({
          where: { patientId: { in: ids } },
          orderBy: { measuredAt: 'desc' },
          take: 10,
        })
      : [],
    ids.length
      ? prisma.healthParameterLog.findMany({
          where: { patientId: { in: ids } },
          orderBy: { measuredAt: 'desc' },
          take: 8,
        })
      : [],
    ids.length
      ? prisma.message.findMany({
          where: { patientId: { in: ids } },
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [],
    prisma.serviceRequest.count({
      where: {
        status: 'PENDING',
        ...(mine ? { pharmacistId: req.user.id } : {}),
      },
    }),
    ids.length
      ? prisma.checkupReminder.count({
          where: {
            patientId: { in: ids },
            status: 'UPCOMING',
            scheduledAt: { lte: new Date(+now + 7 * 86400000) },
          },
        })
      : 0,
  ]);

  const latestBpByPatient = new Map();
  for (const bp of bpLogsRange) {
    if (!latestBpByPatient.has(bp.patientId)) latestBpByPatient.set(bp.patientId, bp);
  }

  // Patients at risk: adherence < 80% OR latest BP HIGH/CRITICAL
  const atRiskPatients = [];
  let activePatients = 0;
  let adherenceSum = 0;
  let adherenceN = 0;

  for (const p of patients) {
    if (p.user.active) activePatients++;
    const adh = rate30Map[p.id];
    if (adh !== null && adh !== undefined) {
      adherenceSum += adh;
      adherenceN++;
    }
    const latestBp = latestBpByPatient.get(p.id) || null;
    const bpCategory = latestBp ? classifyBloodPressure(latestBp.systolic, latestBp.diastolic) : null;
    const isHighBp = bpCategory === 'HIGH' || bpCategory === 'CRITICAL';
    const isLowAdh = adh !== null && adh !== undefined && adh < 80;
    if (isHighBp || isLowAdh) {
      const severity = (bpCategory === 'CRITICAL' ? 100 : isHighBp ? 60 : 0) + (isLowAdh ? 80 - adh : 0);
      atRiskPatients.push({
        id: p.id,
        name: p.user.name,
        studyCode: p.studyCode,
        adherence30: adh,
        latestBp: latestBp
          ? { systolic: latestBp.systolic, diastolic: latestBp.diastolic, category: bpCategory }
          : null,
        riskReason: isHighBp && isLowAdh ? 'BOTH' : isHighBp ? 'BP' : 'ADHERENCE',
        severity,
      });
    }
  }
  atRiskPatients.sort((a, b) => b.severity - a.severity);

  // Daily trend (Adherence % & BP Control %)
  const dayBuckets = new Map();
  for (let i = 0; i < days; i++) {
    const dStr = startDt.plus({ days: i }).toISODate();
    dayBuckets.set(dStr, { date: dStr, taken: 0, resolved: 0, bpControlled: 0, bpTotal: 0, sysSum: 0 });
  }
  for (const d of doseLogsRange) {
    const key = DateTime.fromJSDate(d.scheduledAt).setZone(tz).toISODate();
    const b = dayBuckets.get(key);
    if (!b) continue;
    if (d.status === 'TAKEN') {
      b.taken++;
      b.resolved++;
    } else if (d.status === 'SKIPPED' || d.status === 'MISSED') {
      b.resolved++;
    }
  }
  for (const bp of bpLogsRange) {
    if (bp.measuredAt < since) continue;
    const key = DateTime.fromJSDate(bp.measuredAt).setZone(tz).toISODate();
    const b = dayBuckets.get(key);
    if (!b) continue;
    b.bpTotal++;
    b.sysSum += bp.systolic;
    if (isControlled(bp)) b.bpControlled++;
  }

  const trend = [...dayBuckets.values()].map((b) => ({
    date: b.date,
    adherenceRate: b.resolved ? Math.round((b.taken / b.resolved) * 100) : null,
    bpControlRate: b.bpTotal ? Math.round((b.bpControlled / b.bpTotal) * 100) : null,
    avgSystolic: b.bpTotal ? Math.round(b.sysSum / b.bpTotal) : null,
  }));

  // Unified Recent Activity Feed
  const activities = [];
  for (const d of recentDoses) {
    const p = patientMap.get(d.patientId);
    if (!p) continue;
    activities.push({
      id: `dose-${d.id}`,
      kind: 'DOSE',
      patientId: p.id,
      patientName: p.user.name,
      detail: `${d.medication.name}${d.medication.dosage ? ` ${d.medication.dosage}` : ''}`,
      status: d.status,
      timestamp: d.takenAt || d.scheduledAt,
    });
  }
  for (const bp of recentBps) {
    const p = patientMap.get(bp.patientId);
    if (!p) continue;
    activities.push({
      id: `bp-${bp.id}`,
      kind: 'BP',
      patientId: p.id,
      patientName: p.user.name,
      detail: `${bp.systolic}/${bp.diastolic} mmHg`,
      status: classifyBloodPressure(bp.systolic, bp.diastolic),
      timestamp: bp.measuredAt,
    });
  }
  for (const hp of recentParams) {
    const p = patientMap.get(hp.patientId);
    if (!p) continue;
    activities.push({
      id: `hp-${hp.id}`,
      kind: 'HEALTH_PARAM',
      patientId: p.id,
      patientName: p.user.name,
      detail: `${hp.type}: ${hp.value} ${hp.unit}`,
      status: 'RECORDED',
      timestamp: hp.measuredAt,
    });
  }
  for (const m of recentMessages) {
    const p = patientMap.get(m.patientId);
    if (!p) continue;
    activities.push({
      id: `msg-${m.id}`,
      kind: 'MESSAGE',
      patientId: p.id,
      patientName: p.user.name,
      detail: m.body.slice(0, 80),
      status: m.sender?.role || 'PATIENT',
      timestamp: m.createdAt,
    });
  }
  activities.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  const bpControlled30 = bpLogsRange.filter(isControlled).length;

  res.json({
    kpis: {
      totalPatients: patients.length,
      activePatients,
      needsFollowUp: Math.max(atRiskPatients.length, pendingServices + upcomingCheckups),
      atRiskCount: atRiskPatients.length,
      pendingServices,
      upcomingCheckups,
      avgAdherence30d: adherenceN ? Math.round(adherenceSum / adherenceN) : null,
      bpControlledRate: bpLogsRange.length ? Math.round((bpControlled30 / bpLogsRange.length) * 100) : null,
    },
    atRiskPatients: atRiskPatients.slice(0, 6),
    trend,
    recentActivity: activities.slice(0, 10),
  });
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
  await logAudit(req.user, 'RESET_PATIENT_PASSWORD', 'Patient', req.patient.id);
  res.json({ ok: true });
});

router.get('/:patientId/adherence', resolvePatient, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  res.json(await adherenceFor(req.patient.id, req.patient.user.timezone, days));
});

export default router;

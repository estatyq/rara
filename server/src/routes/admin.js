import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { publicUser, requireRole, requireStaff } from '../auth.js';
import { HttpError, notFound } from '../errors.js';
import { normalizePhone } from './auth.js';
import { getSystemConfigMap, sendWhatsAppMessage } from '../whatsapp.js';
import { logAudit } from '../audit.js';
import { classifyBloodPressure, isControlled } from '../bloodPressure.js';

const router = Router();

const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

// ---- Operational Reports & Platform Analytics (Admin & Staff) --------------

router.get('/overview', requireStaff, async (req, res) => {
  const since30d = new Date(Date.now() - 30 * 86400000);

  const [
    usersByRole,
    pharmacistProfiles,
    doseGroups30d,
    bpLogs30d,
    followUps,
    serviceRequests,
    whatsappCount,
    pharmacistsList,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role', 'active'], _count: { _all: true } }),
    prisma.pharmacistProfile.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
    prisma.doseLog.groupBy({
      by: ['status'],
      where: { scheduledAt: { gte: since30d, lte: new Date() } },
      _count: { _all: true },
    }),
    prisma.bloodPressureLog.findMany({
      where: { measuredAt: { gte: since30d } },
      select: { systolic: true, diastolic: true, source: true },
    }),
    prisma.patientFollowUp.findMany({
      select: { type: true, drpCategory: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceRequest.findMany({
      include: { service: { select: { nameId: true, nameEn: true, code: true } } },
    }),
    prisma.whatsAppLog.count(),
    prisma.user.findMany({
      where: { role: 'PHARMACIST' },
      include: {
        pharmacistProfile: true,
        _count: {
          select: {
            assignedPatients: true,
            followUpsAuthored: true,
            serviceRequests: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const roleSummary = { PATIENT: 0, PHARMACIST: 0, ADMIN: 0, inactive: 0 };
  for (const g of usersByRole) {
    roleSummary[g.role] = (roleSummary[g.role] || 0) + g._count._all;
    if (!g.active) roleSummary.inactive += g._count._all;
  }

  const verificationSummary = { VERIFIED: 0, PENDING: 0, REJECTED: 0 };
  for (const p of pharmacistProfiles) {
    verificationSummary[p.verificationStatus] = p._count._all;
  }

  const doseStats = { TAKEN: 0, SKIPPED: 0, MISSED: 0, PENDING: 0 };
  for (const d of doseGroups30d) {
    doseStats[d.status] = d._count._all;
  }
  const resolvedDoses = doseStats.TAKEN + doseStats.SKIPPED + doseStats.MISSED;
  const overallAdherence30d = resolvedDoses ? Math.round((doseStats.TAKEN / resolvedDoses) * 1000) / 10 : null;

  const bpCategories = { NORMAL: 0, ELEVATED: 0, HIGH: 0, CRITICAL: 0, LOW: 0 };
  let bpControlledCount = 0;
  for (const bp of bpLogs30d) {
    bpCategories[classifyBloodPressure(bp.systolic, bp.diastolic)]++;
    if (isControlled(bp)) bpControlledCount++;
  }
  const bpControlRate30d = bpLogs30d.length ? Math.round((bpControlledCount / bpLogs30d.length) * 100) : null;

  const drpBreakdown = {};
  for (const f of followUps) {
    drpBreakdown[f.drpCategory] = (drpBreakdown[f.drpCategory] || 0) + 1;
  }

  const serviceBreakdown = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const sr of serviceRequests) {
    serviceBreakdown[sr.status] = (serviceBreakdown[sr.status] || 0) + 1;
  }

  res.json({
    users: roleSummary,
    verification: verificationSummary,
    doses30d: {
      ...doseStats,
      resolved: resolvedDoses,
      adherenceRate: overallAdherence30d,
    },
    bloodPressure30d: {
      totalReadings: bpLogs30d.length,
      controlledCount: bpControlledCount,
      controlRate: bpControlRate30d,
      categories: bpCategories,
    },
    followUps: {
      total: followUps.length,
      drpBreakdown,
    },
    serviceRequests: {
      total: serviceRequests.length,
      byStatus: serviceBreakdown,
    },
    whatsappTotalSent: whatsappCount,
    pharmacistWorkload: pharmacistsList.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      active: u.active,
      profile: u.pharmacistProfile,
      assignedPatients: u._count.assignedPatients,
      followUpsCount: u._count.followUpsAuthored,
      serviceRequestsCount: u._count.serviceRequests,
    })),
  });
});

// ---- User Accounts & Access Rights Management (Admin Only) ----------------

router.get('/users', requireRole('ADMIN'), async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const role = req.query.role ? req.query.role.toString() : undefined;
  const where = {};
  if (role && ['PATIENT', 'PHARMACIST', 'ADMIN'].includes(role)) {
    where.role = role;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      patient: { select: { id: true, studyCode: true, diagnosis: true, studyGroup: true, pharmacistId: true } },
      pharmacistProfile: true,
      _count: { select: { assignedPatients: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({ users: users.map(publicUser) });
});

const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().nullable().optional()),
    phone: z.preprocess(emptyToNull, z.string().trim().min(8).max(20).nullable().optional()),
    password: z.string().min(6).max(100),
    role: z.enum(['PATIENT', 'PHARMACIST', 'ADMIN']).default('PHARMACIST'),
    locale: z.enum(['id', 'en']).default('id'),
    // Pharmacist fields if role === PHARMACIST
    straNumber: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
    sipaNumber: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
    workplace: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
    specialization: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
    yearsExperience: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(60).nullable().optional()),
    verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    // Patient fields if role === PATIENT
    studyCode: z.preprocess(emptyToNull, z.string().trim().max(50).nullable().optional()),
    diagnosis: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  })
  .refine((d) => d.email || d.phone, { message: 'Email or phone is required', path: ['email'] });

router.post('/users', requireRole('ADMIN'), async (req, res) => {
  const d = createUserSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(d.password, 10);

  const createData = {
    name: d.name,
    email: d.email || null,
    phone: d.phone ? normalizePhone(d.phone) : null,
    passwordHash,
    role: d.role,
    locale: d.locale,
  };

  if (d.role === 'PHARMACIST') {
    const status = d.verificationStatus || 'VERIFIED';
    createData.pharmacistProfile = {
      create: {
        straNumber: d.straNumber || null,
        sipaNumber: d.sipaNumber || null,
        workplace: d.workplace || null,
        specialization: d.specialization || 'Farmasi Klinis & Kehamilan',
        yearsExperience: d.yearsExperience ?? 3,
        verificationStatus: status,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        verifiedById: status === 'VERIFIED' ? req.user.id : null,
      },
    };
  } else if (d.role === 'PATIENT') {
    createData.patient = {
      create: {
        studyCode: d.studyCode || null,
        diagnosis: d.diagnosis || null,
        consentedAt: new Date(),
      },
    };
  }

  const user = await prisma.user.create({
    data: createData,
    include: {
      patient: true,
      pharmacistProfile: true,
    },
  });

  await logAudit(req.user, 'CREATE_USER', 'User', user.id, { role: user.role, name: user.name });
  res.status(201).json({ user: publicUser(user) });
});

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.preprocess(emptyToNull, z.string().trim().toLowerCase().email().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().min(8).max(20).nullable().optional()),
  role: z.enum(['PATIENT', 'PHARMACIST', 'ADMIN']).optional(),
  active: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
});

router.patch('/users/:id', requireRole('ADMIN'), async (req, res) => {
  const d = updateUserSchema.parse(req.body);
  if (req.params.id === req.user.id && (d.active === false || (d.role && d.role !== 'ADMIN'))) {
    throw new HttpError(400, 'You cannot deactivate or demote your own administrator account');
  }

  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { patient: true, pharmacistProfile: true },
  });
  if (!target) throw notFound('User not found');

  const updateData = {};
  if (d.name !== undefined) updateData.name = d.name;
  if (d.email !== undefined) updateData.email = d.email;
  if (d.phone !== undefined) updateData.phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.role !== undefined) updateData.role = d.role;
  if (d.active !== undefined) updateData.active = d.active;
  if (d.whatsappOptIn !== undefined) updateData.whatsappOptIn = d.whatsappOptIn;
  if (d.password) updateData.passwordHash = await bcrypt.hash(d.password, 10);

  const user = await prisma.user.update({
    where: { id: target.id },
    data: updateData,
    include: { patient: true, pharmacistProfile: true },
  });

  // Ensure profile record exists if role changed
  if (user.role === 'PHARMACIST' && !user.pharmacistProfile) {
    await prisma.pharmacistProfile.create({ data: { userId: user.id, verificationStatus: 'PENDING' } });
  } else if (user.role === 'PATIENT' && !user.patient) {
    await prisma.patient.create({ data: { userId: user.id, consentedAt: new Date() } });
  }

  await logAudit(req.user, 'UPDATE_USER', 'User', user.id, {
    role: d.role,
    active: d.active,
  });

  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    include: { patient: true, pharmacistProfile: true, _count: { select: { assignedPatients: true } } },
  });
  res.json({ user: publicUser(refreshed) });
});

// ---- Pharmacist Credential & License Verification -------------------------

const verifyPharmacistSchema = z.object({
  straNumber: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  sipaNumber: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  workplace: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  specialization: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  yearsExperience: z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(60).nullable().optional()),
  bioId: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  bioEn: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']),
  verificationNote: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
});

router.patch('/pharmacists/:userId/verify', requireRole('ADMIN'), async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!target || target.role !== 'PHARMACIST') {
    throw notFound('Pharmacist user not found');
  }
  const d = verifyPharmacistSchema.parse(req.body);
  const profile = await prisma.pharmacistProfile.upsert({
    where: { userId: target.id },
    create: {
      userId: target.id,
      straNumber: d.straNumber ?? null,
      sipaNumber: d.sipaNumber ?? null,
      workplace: d.workplace ?? null,
      specialization: d.specialization ?? null,
      yearsExperience: d.yearsExperience ?? null,
      bioId: d.bioId ?? null,
      bioEn: d.bioEn ?? null,
      verificationStatus: d.verificationStatus,
      verificationNote: d.verificationNote ?? null,
      verifiedAt: d.verificationStatus === 'VERIFIED' ? new Date() : null,
      verifiedById: d.verificationStatus === 'VERIFIED' ? req.user.id : null,
    },
    update: {
      ...(d.straNumber !== undefined ? { straNumber: d.straNumber } : {}),
      ...(d.sipaNumber !== undefined ? { sipaNumber: d.sipaNumber } : {}),
      ...(d.workplace !== undefined ? { workplace: d.workplace } : {}),
      ...(d.specialization !== undefined ? { specialization: d.specialization } : {}),
      ...(d.yearsExperience !== undefined ? { yearsExperience: d.yearsExperience } : {}),
      ...(d.bioId !== undefined ? { bioId: d.bioId } : {}),
      ...(d.bioEn !== undefined ? { bioEn: d.bioEn } : {}),
      verificationStatus: d.verificationStatus,
      verificationNote: d.verificationNote ?? null,
      verifiedAt: d.verificationStatus === 'VERIFIED' ? new Date() : null,
      verifiedById: d.verificationStatus === 'VERIFIED' ? req.user.id : null,
    },
  });

  await logAudit(req.user, 'VERIFY_PHARMACIST', 'PharmacistProfile', profile.id, {
    pharmacist: target.name,
    status: d.verificationStatus,
    straNumber: profile.straNumber,
    sipaNumber: profile.sipaNumber,
  });

  res.json({ profile });
});

// ---- System, Database, Audit Log & WhatsApp Gateway Management ------------

router.get('/system', requireRole('ADMIN'), async (req, res) => {
  const [
    usersCount,
    patientsCount,
    pharmacistsCount,
    medicationsCount,
    doseLogsCount,
    bpLogsCount,
    messagesCount,
    articlesCount,
    questionnairesCount,
    responsesCount,
    servicesCount,
    serviceRequestsCount,
    followUpsCount,
    whatsappLogsCount,
    configMap,
    recentAuditLogs,
    recentWhatsAppLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.patient.count(),
    prisma.pharmacistProfile.count(),
    prisma.medication.count(),
    prisma.doseLog.count(),
    prisma.bloodPressureLog.count(),
    prisma.message.count(),
    prisma.article.count(),
    prisma.questionnaire.count(),
    prisma.questionnaireResponse.count(),
    prisma.pharmacyService.count(),
    prisma.serviceRequest.count(),
    prisma.patientFollowUp.count(),
    prisma.whatsAppLog.count(),
    getSystemConfigMap(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.whatsAppLog.findMany({
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  res.json({
    database: {
      healthy: true,
      engine: 'PostgreSQL 16 (Prisma ORM)',
      tables: {
        users: usersCount,
        patients: patientsCount,
        pharmacistProfiles: pharmacistsCount,
        medications: medicationsCount,
        doseLogs: doseLogsCount,
        bloodPressureLogs: bpLogsCount,
        messages: messagesCount,
        articles: articlesCount,
        questionnaires: questionnairesCount,
        questionnaireResponses: responsesCount,
        pharmacyServices: servicesCount,
        serviceRequests: serviceRequestsCount,
        patientFollowUps: followUpsCount,
        whatsappLogs: whatsappLogsCount,
      },
    },
    config: configMap,
    auditLogs: recentAuditLogs,
    whatsappLogs: recentWhatsAppLogs,
  });
});

router.put('/system/config', requireRole('ADMIN'), async (req, res) => {
  const schema = z.record(z.string(), z.string());
  const updates = schema.parse(req.body);
  for (const [key, value] of Object.entries(updates)) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  await logAudit(req.user, 'UPDATE_SYSTEM_CONFIG', 'SystemConfig', null, Object.keys(updates));
  res.json({ config: await getSystemConfigMap() });
});

router.post('/whatsapp/send', requireStaff, async (req, res) => {
  const { phone, message, category, patientId } = z
    .object({
      phone: z.string().trim().min(8).max(20),
      message: z.string().trim().min(2).max(2000),
      category: z.enum(['DOSE_REMINDER', 'BP_ALERT', 'FOLLOW_UP', 'CONSULTATION', 'SYSTEM']).default('SYSTEM'),
      patientId: z.string().optional(),
    })
    .parse(req.body);

  const normalized = normalizePhone(phone);
  const log = await sendWhatsAppMessage({
    phone: normalized,
    message,
    category,
    patientId: patientId || null,
  });
  await logAudit(req.user, 'SEND_WHATSAPP', 'WhatsAppLog', log?.id, { phone: normalized, category });
  res.status(201).json({ log });
});

export default router;

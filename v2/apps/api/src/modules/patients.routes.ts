import { prisma, withTenant } from '@dosemate/db';
import {
  classifyBloodPressure,
  CreateAllergySchema,
  CreateCaregiverInviteSchema,
  isBpControlled,
  normalizeInternationalPhone,
} from '@dosemate/shared';
import type { FastifyInstance } from 'fastify';
import type { CountryCode } from 'libphonenumber-js';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate, requireTenantStaff, resolvePatientAccess } from '../lib/auth.js';
import { adherenceRateMap } from '../lib/doses.js';
import { notFound } from '../lib/errors.js';

export async function patientRoutes(app: FastifyInstance) {
  /**
   * Pharmacist Web Dashboard Summary — strictly tenant-isolated via PostgreSQL RLS (`withTenant`)!
   * Powers the DoseLynx Dashboard Web Farmasis: 4 KPIs, Patients at Risk, Dual-Line Trend, Recent Activity.
   */
  app.get('/dashboard-summary', { preHandler: [requireTenantStaff] }, async (req) => {
    const query = z.object({
      days: z.enum(['7', '30']).default('7'),
      mine: z.enum(['0', '1']).default('0'),
    }).parse(req.query);

    const days = Number(query.days);
    const tenantId = req.auth.activeTenantId!;
    const tz = req.auth.timezone || 'Asia/Jakarta';
    const startDt = DateTime.now().setZone(tz).startOf('day').minus({ days: days - 1 });
    const since = startDt.toJSDate();
    const now = new Date();

    const enrollments = await withTenant(tenantId, (tx) =>
      tx.careEnrollment.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(query.mine === '1' ? { pharmacistId: req.auth.userId } : {}),
        },
        include: {
          patient: {
            include: {
              user: { select: { id: true, name: true, phone: true, active: true } },
            },
          },
        },
      }),
    );

    const patientIds = enrollments.map((e) => e.patientId);
    const byPatient = new Map(enrollments.map((e) => [e.patientId, e]));

    const [rate30Map, doseLogsRange, bpLogs30d, recentDoses, recentBps, recentMsgs, pendingServices] = await Promise.all([
      adherenceRateMap(patientIds, 30),
      patientIds.length
        ? prisma.doseLog.findMany({
            where: { patientId: { in: patientIds }, scheduledAt: { gte: since, lte: now } },
            select: { patientId: true, status: true, localDate: true },
          })
        : [],
      patientIds.length
        ? prisma.bloodPressureLog.findMany({
            where: { patientId: { in: patientIds }, measuredAt: { gte: new Date(+now - 30 * 86400000) } },
            orderBy: { measuredAt: 'desc' },
          })
        : [],
      patientIds.length
        ? prisma.doseLog.findMany({
            where: { patientId: { in: patientIds }, status: { in: ['TAKEN', 'SKIPPED'] }, takenAt: { not: null } },
            include: { medication: { select: { displayName: true, dosage: true } } },
            orderBy: { takenAt: 'desc' },
            take: 8,
          })
        : [],
      patientIds.length
        ? prisma.bloodPressureLog.findMany({
            where: { patientId: { in: patientIds } },
            orderBy: { measuredAt: 'desc' },
            take: 8,
          })
        : [],
      withTenant(tenantId, (tx) =>
        tx.message.findMany({
          where: { tenantId, ...(patientIds.length ? { patientId: { in: patientIds } } : { patientId: '__none__' }) },
          include: { sender: { select: { id: true, name: true, globalRole: true } } },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ),
      withTenant(tenantId, (tx) =>
        tx.serviceRequest.count({ where: { tenantId, status: 'PENDING' } }),
      ),
    ]);

    const latestBpByPatient = new Map<string, (typeof bpLogs30d)[number]>();
    for (const bp of bpLogs30d) {
      if (!latestBpByPatient.has(bp.patientId)) latestBpByPatient.set(bp.patientId, bp);
    }

    const atRiskPatients = [];
    let adhSum = 0;
    let adhN = 0;
    let activePatients = 0;

    for (const e of enrollments) {
      if (e.patient.user.active) activePatients++;
      const adh = rate30Map[e.patientId] ?? null;
      if (adh !== null) {
        adhSum += adh;
        adhN++;
      }
      const latestBp = latestBpByPatient.get(e.patientId) ?? null;
      const bpCat = latestBp ? classifyBloodPressure(latestBp.systolic, latestBp.diastolic) : null;
      const highBp = bpCat === 'HIGH' || bpCat === 'CRITICAL';
      const lowAdh = adh !== null && adh < 80;
      if (highBp || lowAdh) {
        atRiskPatients.push({
          patientId: e.patientId,
          name: e.patient.user.name,
          studyCode: e.studyCode,
          adherence30: adh,
          latestBp: latestBp
            ? {
                id: latestBp.id,
                systolic: latestBp.systolic,
                diastolic: latestBp.diastolic,
                category: bpCat,
                alertStatus: latestBp.alertStatus,
              }
            : null,
          severity: (bpCat === 'CRITICAL' ? 100 : highBp ? 60 : 0) + (lowAdh ? 80 - adh : 0),
        });
      }
    }
    atRiskPatients.sort((a, b) => b.severity - a.severity);

    const buckets = new Map<string, { date: string; taken: number; resolved: number; bpOk: number; bpAll: number }>();
    for (let i = 0; i < days; i++) {
      const dStr = startDt.plus({ days: i }).toISODate()!;
      buckets.set(dStr, { date: dStr, taken: 0, resolved: 0, bpOk: 0, bpAll: 0 });
    }
    for (const d of doseLogsRange) {
      const b = buckets.get(d.localDate);
      if (!b) continue;
      if (d.status === 'TAKEN') {
        b.taken++;
        b.resolved++;
      } else if (d.status === 'SKIPPED' || d.status === 'MISSED') {
        b.resolved++;
      }
    }
    for (const bp of bpLogs30d) {
      if (bp.measuredAt < since) continue;
      const key = DateTime.fromJSDate(bp.measuredAt).setZone(tz).toISODate()!;
      const b = buckets.get(key);
      if (!b) continue;
      b.bpAll++;
      if (isBpControlled(bp)) b.bpOk++;
    }

    const trend = [...buckets.values()].map((b) => ({
      date: b.date,
      adherenceRate: b.resolved ? Math.round((b.taken / b.resolved) * 100) : null,
      bpControlRate: b.bpAll ? Math.round((b.bpOk / b.bpAll) * 100) : null,
    }));

    const activities = [
      ...recentDoses.map((d) => ({
        id: `dose-${d.id}`,
        kind: 'DOSE' as const,
        patientId: d.patientId,
        patientName: byPatient.get(d.patientId)?.patient.user.name ?? 'Patient',
        detail: `${d.medication.displayName}${d.medication.dosage ? ` ${d.medication.dosage}` : ''}`,
        timestamp: (d.takenAt ?? d.scheduledAt).toISOString(),
      })),
      ...recentBps.map((bp) => ({
        id: `bp-${bp.id}`,
        kind: 'BP' as const,
        patientId: bp.patientId,
        patientName: byPatient.get(bp.patientId)?.patient.user.name ?? 'Patient',
        detail: `${bp.systolic}/${bp.diastolic} mmHg`,
        timestamp: bp.measuredAt.toISOString(),
      })),
      ...recentMsgs.map((m) => ({
        id: `msg-${m.id}`,
        kind: 'MESSAGE' as const,
        patientId: m.patientId,
        patientName: byPatient.get(m.patientId)?.patient.user.name ?? 'Patient',
        detail: m.body.slice(0, 72),
        timestamp: m.createdAt.toISOString(),
      })),
    ].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

    return {
      tenantId,
      kpis: {
        totalPatients: enrollments.length,
        activePatients,
        needsFollowUp: atRiskPatients.length + pendingServices,
        avgAdherence30d: adhN ? Math.round(adhSum / adhN) : null,
      },
      atRiskPatients: atRiskPatients.slice(0, 6),
      trend,
      recentActivity: activities.slice(0, 10),
    };
  });

  /**
   * Cursor-paginated tenant-isolated patient list.
   */
  app.get('/', { preHandler: [requireTenantStaff] }, async (req) => {
    const query = z.object({
      q: z.string().trim().optional(),
      mine: z.enum(['0', '1']).default('0'),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      cursor: z.string().optional(),
    }).parse(req.query);

    const tenantId = req.auth.activeTenantId!;
    const enrollments = await withTenant(tenantId, (tx) =>
      tx.careEnrollment.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(query.mine === '1' ? { pharmacistId: req.auth.userId } : {}),
          ...(query.q
            ? {
                OR: [
                  { studyCode: { contains: query.q, mode: 'insensitive' } },
                  { patient: { diagnosis: { contains: query.q, mode: 'insensitive' } } },
                  { patient: { user: { name: { contains: query.q, mode: 'insensitive' } } } },
                  { patient: { user: { phone: { contains: query.q } } } },
                ],
              }
            : {}),
        },
        include: {
          pharmacist: { select: { id: true, name: true } },
          patient: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true, locale: true, timezone: true } },
              _count: { select: { medications: { where: { active: true } } } },
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
    );

    const hasMore = enrollments.length > query.limit;
    const slice = hasMore ? enrollments.slice(0, query.limit) : enrollments;
    const patientIds = slice.map((e) => e.patientId);
    const [rate30, latestBps] = await Promise.all([
      adherenceRateMap(patientIds, 30),
      patientIds.length
        ? prisma.bloodPressureLog.findMany({
            where: { patientId: { in: patientIds } },
            orderBy: { measuredAt: 'desc' },
          })
        : [],
    ]);

    const bpMap = new Map<string, (typeof latestBps)[number]>();
    for (const bp of latestBps) {
      if (!bpMap.has(bp.patientId)) bpMap.set(bp.patientId, bp);
    }

    return {
      patients: slice.map((e) => {
        const bp = bpMap.get(e.patientId) ?? null;
        return {
          enrollmentId: e.id,
          id: e.patientId,
          studyCode: e.studyCode,
          studyGroup: e.studyGroup,
          diagnosis: e.patient.diagnosis,
          estimatedDueDate: e.patient.estimatedDueDate,
          user: e.patient.user,
          pharmacist: e.pharmacist,
          activeMedications: e.patient._count.medications,
          adherence30: rate30[e.patientId] ?? null,
          latestBloodPressure: bp
            ? {
                systolic: bp.systolic,
                diastolic: bp.diastolic,
                measuredAt: bp.measuredAt,
                category: classifyBloodPressure(bp.systolic, bp.diastolic),
                alertStatus: bp.alertStatus,
              }
            : null,
        };
      }),
      nextCursor: hasMore ? slice[slice.length - 1]?.id ?? null : null,
    };
  });

  app.get('/:patientId', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);

    const profile = await prisma.patientProfile.findUnique({
      where: { id: ctx.patientId },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, phone: true, locale: true,
            timezone: true, privacyMode: true, whatsappOptIn: true,
          },
        },
        allergies: { orderBy: { createdAt: 'desc' } },
        caregivers: { where: { status: 'ACTIVE' } },
        enrollments: {
          where: { status: 'ACTIVE', ...(req.auth.activeTenantId ? { tenantId: req.auth.activeTenantId } : {}) },
          include: {
            tenant: { select: { id: true, name: true, inviteCode: true } },
            pharmacist: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });
    if (!profile) throw notFound('Patient not found');

    // Never leak internal pharmacist notes to patients
    const sanitizedEnrollments = profile.enrollments.map((e) => ({
      ...e,
      internalNotes: req.auth.tenantRole ? e.internalNotes : undefined,
    }));

    return { patient: { ...profile, enrollments: sanitizedEnrollments } };
  });

  // ---- Structured Allergies ----
  app.post('/:patientId/allergies', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const data = CreateAllergySchema.parse(req.body);

    const allergy = await prisma.patientAllergy.create({
      data: {
        patientId: ctx.patientId,
        substanceName: data.substanceName,
        substanceCode: data.substanceCode ?? null,
        severity: data.severity,
        reaction: data.reaction ?? null,
      },
    });
    return reply.status(201).send({ allergy });
  });

  // ---- Caregiver / Family Mode ----
  app.post('/:patientId/caregivers', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const data = CreateCaregiverInviteSchema.parse(req.body);
    const target = data.caregiverPhone
      ? normalizeInternationalPhone(data.caregiverPhone, 'ID' as CountryCode) ?? data.caregiverPhone
      : data.caregiverEmail ?? '';

    const caregiverUser = target.includes('@')
      ? await prisma.user.findUnique({ where: { email: target } })
      : await prisma.user.findUnique({ where: { phone: target } });

    const link = await prisma.caregiverLink.create({
      data: {
        patientId: ctx.patientId,
        caregiverUserId: caregiverUser?.id ?? null,
        inviteTarget: target,
        relationship: data.relationship,
        canViewAdherence: data.canViewAdherence,
        receiveCriticalAlerts: data.receiveCriticalAlerts,
        status: 'ACTIVE',
      },
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.globalRole,
      action: 'ADD_CAREGIVER_LINK',
      entityType: 'CaregiverLink',
      entityId: link.id,
      ipAddress: req.ip,
    });

    return reply.status(201).send({ caregiver: link });
  });
}

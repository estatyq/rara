import { prisma, withTenant } from '@dosemate/db';
import { CreateFollowUpSchema, ErrorCode } from '@dosemate/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate, requireTenantStaff, requireVerifiedPharmacist, resolvePatientAccess } from '../lib/auth.js';
import { adherenceRateMap } from '../lib/doses.js';
import { badRequest, notFound } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { emitToTenantPatient } from '../lib/realtime.js';

export async function careRoutes(app: FastifyInstance) {
  // ---- Pharmaceutical Care Services (Multi-Language Translation Table) ----
  app.get('/services', { preHandler: [authenticate] }, async (req) => {
    const { locale } = z.object({ locale: z.enum(['id', 'en']).default(req.auth.locale) }).parse(req.query);
    const tenantId = req.auth.activeTenantId;
    const services = await prisma.pharmacyService.findMany({
      where: {
        active: true,
        ...(tenantId ? { OR: [{ tenantId }, { tenantId: null }] } : {}),
      },
      include: { translations: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      services: services.map((s) => {
        const tr = s.translations.find((x) => x.locale === locale) ?? s.translations[0];
        return {
          id: s.id,
          code: s.code,
          category: s.category,
          durationMinutes: s.durationMinutes,
          priceMinor: s.priceMinor,
          currency: s.currency,
          icon: s.icon,
          name: tr?.name ?? s.code,
          description: tr?.description ?? '',
        };
      }),
    };
  });

  // ---- Service Requests (Strictly Tenant-Scoped via RLS) ----
  app.get('/services/requests', { preHandler: [authenticate] }, async (req) => {
    if (req.auth.activeTenantId && req.auth.tenantRole) {
      const tenantId = req.auth.activeTenantId;
      const requests = await withTenant(tenantId, (tx) =>
        tx.serviceRequest.findMany({
          where: { tenantId },
          include: {
            service: { include: { translations: true } },
            patient: { include: { user: { select: { id: true, name: true, phone: true } } } },
            pharmacist: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );
      return { requests };
    }

    if (!req.auth.patientProfileId) return { requests: [] };
    const requests = await prisma.serviceRequest.findMany({
      where: { patientId: req.auth.patientProfileId },
      include: {
        service: { include: { translations: true } },
        pharmacist: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { requests };
  });

  app.post('/services/requests', { preHandler: [authenticate] }, async (req, reply) => {
    const ctx = await resolvePatientAccess(req, 'me');
    if (!ctx.tenantId) {
      throw badRequest(ErrorCode.TENANT_REQUIRED, 'Enroll with a pharmacy via QR invite code before requesting care services');
    }
    const data = z.object({
      serviceId: z.string().min(1),
      preferredDate: z.string().datetime().optional(),
      complaint: z.string().trim().max(1000).optional(),
    }).parse(req.body);

    const requestRecord = await withTenant(ctx.tenantId, (tx) =>
      tx.serviceRequest.create({
        data: {
          tenantId: ctx.tenantId!,
          patientId: ctx.patientId,
          serviceId: data.serviceId,
          pharmacistId: ctx.pharmacistId,
          preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
          complaint: data.complaint ?? null,
          status: 'PENDING',
        },
      }),
    );

    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'service:requested', requestRecord);
    return reply.status(201).send({ request: requestRecord });
  });

  // ---- PTO / SOAP Clinical Follow-Ups (Requires Verified Pharmacist!) ----
  app.get('/patients/:patientId/follow-ups', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);

    const followUps = ctx.tenantId
      ? await withTenant(ctx.tenantId, (tx) =>
          tx.patientFollowUp.findMany({
            where: { tenantId: ctx.tenantId!, patientId: ctx.patientId },
            include: {
              pharmacist: {
                select: {
                  id: true, name: true,
                  pharmacistCredentials: { where: { verificationStatus: 'VERIFIED' } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
        )
      : await prisma.patientFollowUp.findMany({
          where: { patientId: ctx.patientId },
          include: {
            pharmacist: {
              select: {
                id: true, name: true,
                pharmacistCredentials: { where: { verificationStatus: 'VERIFIED' } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

    return { followUps };
  });

  app.post('/patients/:patientId/follow-ups', { preHandler: [requireVerifiedPharmacist] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const tenantId = req.auth.activeTenantId!;
    const data = CreateFollowUpSchema.parse(req.body);

    const [adhMap, latestBp] = await Promise.all([
      adherenceRateMap([ctx.patientId], 30),
      prisma.bloodPressureLog.findFirst({ where: { patientId: ctx.patientId }, orderBy: { measuredAt: 'desc' } }),
    ]);

    const followUp = await withTenant(tenantId, (tx) =>
      tx.patientFollowUp.create({
        data: {
          tenantId,
          patientId: ctx.patientId,
          pharmacistId: req.auth.userId,
          type: data.type,
          subjective: data.subjective ?? null,
          objective: data.objective ?? null,
          assessment: data.assessment ?? null,
          plan: data.plan,
          drpCategory: data.drpCategory,
          recommendation: data.recommendation ?? null,
          adherenceRate: adhMap[ctx.patientId] ?? null,
          latestBp: latestBp ? `${latestBp.systolic}/${latestBp.diastolic} mmHg` : null,
          nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
          sentViaWhatsApp: data.sendViaWhatsApp,
        },
      }),
    );

    if (followUp.nextFollowUpDate) {
      await prisma.checkupReminder.create({
        data: {
          patientId: ctx.patientId,
          tenantId,
          createdById: req.auth.userId,
          title: ctx.locale === 'en' ? 'Pharmacotherapy Follow-Up (PTO)' : 'Tindak Lanjut Evaluasi PTO',
          type: 'FOLLOW_UP',
          scheduledAt: followUp.nextFollowUpDate,
          notes: data.recommendation ?? data.plan.slice(0, 200),
          status: 'UPCOMING',
        },
      });
    }

    await writeAuditLog({
      tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.tenantRole ?? req.auth.globalRole,
      action: 'CREATE_PTO_FOLLOW_UP',
      entityType: 'PatientFollowUp',
      entityId: followUp.id,
      ipAddress: req.ip,
      details: { drpCategory: followUp.drpCategory, verificationHash: followUp.verificationHash },
    });

    emitToTenantPatient(tenantId, ctx.patientId, 'followup:created', followUp);
    return reply.status(201).send({ followUp });
  });

  /**
   * Public tamper-evident QR verification endpoint for printed PTO PDF reports (zero PHI exposed!).
   */
  app.get('/follow-ups/verify/:hash', async (req) => {
    const { hash } = z.object({ hash: z.string().min(6) }).parse(req.params);
    const rec = await prisma.patientFollowUp.findFirst({
      where: { verificationHash: hash },
      include: {
        tenant: { select: { name: true, countryCode: true } },
        pharmacist: {
          select: {
            name: true,
            pharmacistCredentials: {
              where: { verificationStatus: 'VERIFIED' },
              select: { licenseType: true, licenseNumber: true, issuingAuthority: true },
            },
          },
        },
      },
    });
    if (!rec) throw notFound('PTO verification record not found');
    return {
      verified: true,
      issuedAt: rec.createdAt,
      pharmacy: rec.tenant.name,
      pharmacist: rec.pharmacist.name,
      credentials: rec.pharmacist.pharmacistCredentials,
    };
  });

  // ---- Consultation Chat (Strictly Tenant-Isolated via RLS) ----
  app.get('/patients/:patientId/messages', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const tenantId = req.auth.activeTenantId ?? ctx.tenantId;
    if (!tenantId) return { messages: [] };

    const messages = await withTenant(tenantId, (tx) =>
      tx.message.findMany({
        where: { tenantId, patientId: ctx.patientId },
        include: { sender: { select: { id: true, name: true, globalRole: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    );

    return { messages };
  });

  app.post('/patients/:patientId/messages', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const tenantId = req.auth.activeTenantId ?? ctx.tenantId;
    if (!tenantId) {
      throw badRequest(ErrorCode.TENANT_REQUIRED, 'Enroll with a pharmacy first to start consultation chat');
    }
    const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);

    return withIdempotency(req, reply, req.auth.userId, 201, async () => {
      const message = await withTenant(tenantId, (tx) =>
        tx.message.create({
          data: {
            tenantId,
            patientId: ctx.patientId,
            senderId: req.auth.userId,
            body,
          },
          include: { sender: { select: { id: true, name: true, globalRole: true } } },
        }),
      );
      emitToTenantPatient(tenantId, ctx.patientId, 'message:new', message);
      return { message };
    });
  });

  app.get('/conversations', { preHandler: [requireTenantStaff] }, async (req) => {
    const tenantId = req.auth.activeTenantId!;
    const rows = await withTenant(tenantId, (tx) =>
      tx.message.findMany({
        where: { tenantId },
        include: {
          sender: { select: { id: true, name: true, globalRole: true } },
          patient: { include: { user: { select: { id: true, name: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );

    // Deduplicate latest message per patient in O(N) — ZERO N+1 queries!
    const seen = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!seen.has(r.patientId)) seen.set(r.patientId, r);
    }

    return {
      conversations: [...seen.values()].map((m) => ({
        patientId: m.patientId,
        patient: { id: m.patientId, user: m.patient.user },
        lastMessage: { id: m.id, body: m.body, createdAt: m.createdAt, sender: m.sender },
      })),
    };
  });
}

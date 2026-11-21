import { prisma } from '@dosemate/db';
import { buildBpAlertText } from '@dosemate/i18n';
import {
  classifyBloodPressure,
  CLINICAL_GUIDELINE_CITATIONS,
  computeMeanArterialPressure,
  CreateCheckupReminderSchema,
  ErrorCode,
  isBpControlled,
  RecordBloodPressureSchema,
  RecordHealthParameterSchema,
  summarizeBloodPressures,
} from '@dosemate/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate, requireVerifiedPharmacist, resolvePatientAccess } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { enqueueCriticalBpEscalation } from '../lib/queues.js';
import { emitToTenantPatient } from '../lib/realtime.js';

export async function healthRoutes(app: FastifyInstance) {
  // ---- Blood Pressure Monitoring + 15-min Critical Escalation SLA ----
  app.get('/patients/:patientId/blood-pressure', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const q = z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
      limit: z.coerce.number().int().min(1).max(200).default(60),
    }).parse(req.query);
    const ctx = await resolvePatientAccess(req, patientId);

    const since = new Date(Date.now() - q.days * 86400000);
    const logs = await prisma.bloodPressureLog.findMany({
      where: { patientId: ctx.patientId, measuredAt: { gte: since } },
      orderBy: { measuredAt: 'desc' },
      take: q.limit,
    });

    return {
      citation: CLINICAL_GUIDELINE_CITATIONS.bpGeneral[ctx.locale],
      logs: logs.map((l) => ({
        ...l,
        category: classifyBloodPressure(l.systolic, l.diastolic),
        controlled: isBpControlled(l),
        map: computeMeanArterialPressure(l.systolic, l.diastolic),
      })),
      summary: summarizeBloodPressures(logs, q.days),
    };
  });

  app.post('/patients/:patientId/blood-pressure', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const data = RecordBloodPressureSchema.parse(req.body);

    const measuredAt = data.measuredAt ? new Date(data.measuredAt) : new Date();
    if (measuredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw badRequest(ErrorCode.BP_INVALID_RANGE, 'Measurement time cannot be in the future');
    }

    return withIdempotency(req, reply, req.auth.userId, 201, async () => {
      const category = classifyBloodPressure(data.systolic, data.diastolic);
      const isCritical = category === 'CRITICAL';

      const log = await prisma.bloodPressureLog.create({
        data: {
          patientId: ctx.patientId,
          systolic: data.systolic,
          diastolic: data.diastolic,
          pulse: data.pulse ?? null,
          measuredAt,
          note: data.note ?? null,
          source: req.auth.tenantRole ? (data.source ?? 'CLINIC') : (data.source ?? 'SELF'),
          alertStatus: isCritical ? 'PENDING_ACK' : 'NONE',
        },
      });

      const enriched = {
        ...log,
        category,
        controlled: isBpControlled(log),
        map: computeMeanArterialPressure(log.systolic, log.diastolic),
      };

      emitToTenantPatient(ctx.tenantId, ctx.patientId, 'blood-pressure:changed', enriched);

      if (category === 'CRITICAL' || category === 'HIGH') {
        // Privacy-aware alert preview (respects Lock-Screen privacyMode!)
        const alertMessage = buildBpAlertText({
          locale: ctx.locale,
          privacyMode: ctx.privacyMode,
          patientName: ctx.name,
          systolic: log.systolic,
          diastolic: log.diastolic,
          category,
        });

        await prisma.notificationLog.create({
          data: {
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            patientId: ctx.patientId,
            channel: 'WHATSAPP',
            category: 'BP_ALERT',
            templateName: 'bp_critical_alert_v1',
            recipient: ctx.userId,
            payloadPreview: alertMessage,
            status: 'QUEUED',
            provider: 'SIMULATOR',
          },
        });

        if (isCritical) {
          // Schedule 15-min SLA escalation job in Valkey/BullMQ
          await enqueueCriticalBpEscalation({
            bpLogId: log.id,
            patientId: ctx.patientId,
            tenantId: ctx.tenantId,
          });
        }
      }

      return { log: enriched };
    });
  });

  /**
   * Verified pharmacist acknowledges a CRITICAL BP alert, stopping the 15-minute escalation SLA
   * and logging clinical response time in AuditLog.
   */
  app.post('/blood-pressure/:id/acknowledge', { preHandler: [requireVerifiedPharmacist] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.bloodPressureLog.findUnique({ where: { id } });
    if (!existing) throw notFound('Blood pressure record not found');

    const ctx = await resolvePatientAccess(req, existing.patientId);
    const ackAt = new Date();
    const responseSeconds = Math.round((ackAt.getTime() - existing.createdAt.getTime()) / 1000);

    const updated = await prisma.bloodPressureLog.update({
      where: { id: existing.id },
      data: {
        alertStatus: 'ACKNOWLEDGED',
        acknowledgedById: req.auth.userId,
        acknowledgedAt: ackAt,
      },
    });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.tenantRole ?? req.auth.globalRole,
      action: 'ACKNOWLEDGE_CRITICAL_BP',
      entityType: 'BloodPressureLog',
      entityId: updated.id,
      ipAddress: req.ip,
      details: { responseSeconds, systolic: updated.systolic, diastolic: updated.diastolic },
    });

    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'blood-pressure:acknowledged', updated);
    return { log: updated, responseSeconds };
  });

  // ---- Other Health Parameters (Weight, SpO2, Heart Rate, Temp, Fetal Movement, Edema, Glucose) ----
  app.get('/patients/:patientId/health-parameters', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const q = z.object({
      type: z.string().optional(),
      days: z.coerce.number().int().min(1).max(365).default(90),
    }).parse(req.query);
    const ctx = await resolvePatientAccess(req, patientId);

    const logs = await prisma.healthParameterLog.findMany({
      where: {
        patientId: ctx.patientId,
        ...(q.type ? { type: q.type } : {}),
        measuredAt: { gte: new Date(Date.now() - q.days * 86400000) },
      },
      orderBy: { measuredAt: 'desc' },
      take: 150,
    });
    return { logs };
  });

  app.post('/patients/:patientId/health-parameters', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const data = RecordHealthParameterSchema.parse(req.body);

    return withIdempotency(req, reply, req.auth.userId, 201, async () => {
      const log = await prisma.healthParameterLog.create({
        data: {
          patientId: ctx.patientId,
          type: data.type,
          value: data.value,
          unit: data.unit,
          context: data.context ?? null,
          note: data.note ?? null,
          source: req.auth.tenantRole ? (data.source ?? 'CLINIC') : (data.source ?? 'SELF'),
          measuredAt: data.measuredAt ? new Date(data.measuredAt) : new Date(),
        },
      });
      emitToTenantPatient(ctx.tenantId, ctx.patientId, 'health-parameter:changed', log);
      return { log };
    });
  });

  // ---- Check-Up & Follow-Up Reminders ----
  app.get('/patients/:patientId/checkups', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const reminders = await prisma.checkupReminder.findMany({
      where: { patientId: ctx.patientId },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
      take: 100,
    });
    return { reminders };
  });

  app.post('/patients/:patientId/checkups', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const data = CreateCheckupReminderSchema.parse(req.body);

    const reminder = await prisma.checkupReminder.create({
      data: {
        patientId: ctx.patientId,
        tenantId: req.auth.activeTenantId ?? ctx.tenantId,
        createdById: req.auth.userId,
        title: data.title,
        type: data.type,
        scheduledAt: new Date(data.scheduledAt),
        location: data.location ?? null,
        notes: data.notes ?? null,
        status: 'UPCOMING',
      },
    });
    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'checkup:changed', reminder);
    return reply.status(201).send({ reminder });
  });

  app.patch('/checkups/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.checkupReminder.findUnique({ where: { id } });
    if (!existing) throw notFound('Check-up reminder not found');
    const ctx = await resolvePatientAccess(req, existing.patientId);

    const patch = z.object({
      status: z.enum(['UPCOMING', 'COMPLETED', 'CANCELLED']).optional(),
      title: z.string().trim().min(2).max(200).optional(),
      scheduledAt: z.string().datetime().optional(),
    }).parse(req.body);

    const reminder = await prisma.checkupReminder.update({
      where: { id: existing.id },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.title ? { title: patch.title } : {}),
        ...(patch.scheduledAt ? { scheduledAt: new Date(patch.scheduledAt), remindedAt: null } : {}),
      },
    });
    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'checkup:changed', reminder);
    return { reminder };
  });
}

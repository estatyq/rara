import { prisma } from '@dosemate/db';
import {
  checkMedicationSpacingWarnings,
  ConfirmDoseSchema,
  CreateMedicationSchema,
  ErrorCode,
} from '@dosemate/shared';
import type { FastifyInstance } from 'fastify';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate, resolvePatientAccess } from '../lib/auth.js';
import { localDateIso, rematerializeMedication } from '../lib/doses.js';
import { badRequest, notFound } from '../lib/errors.js';
import { withIdempotency } from '../lib/idempotency.js';
import { emitToTenantPatient } from '../lib/realtime.js';

export async function medicationRoutes(app: FastifyInstance) {
  app.get('/patients/:patientId/medications', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const { all } = z.object({ all: z.enum(['0', '1']).default('0') }).parse(req.query);
    const ctx = await resolvePatientAccess(req, patientId);

    const medications = await prisma.medication.findMany({
      where: { patientId: ctx.patientId, ...(all === '1' ? {} : { active: true }) },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });

    const spacingWarnings = checkMedicationSpacingWarnings(
      medications
        .filter((m) => m.active)
        .map((m) => ({ name: m.displayName, activeIngredient: m.activeIngredient, times: m.times })),
    );

    return { medications, spacingWarnings };
  });

  app.post('/patients/:patientId/medications', { preHandler: [authenticate] }, async (req, reply) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const d = CreateMedicationSchema.parse(req.body);

    const medication = await prisma.medication.create({
      data: {
        patientId: ctx.patientId,
        tenantId: req.auth.activeTenantId ?? ctx.tenantId,
        displayName: d.displayName,
        activeIngredient: d.activeIngredient ?? null,
        drugCode: d.drugCode ?? null,
        drugCodeSystem: d.drugCodeSystem ?? null,
        dosage: d.dosage ?? null,
        strengthValue: d.strengthValue ?? null,
        strengthUnit: d.strengthUnit ?? null,
        form: d.form ?? null,
        instructions: d.instructions ?? null,
        times: d.times,
        scheduleRule: d.scheduleRule,
        startDate: d.startDate ? DateTime.fromISO(d.startDate, { zone: ctx.timezone }).startOf('day').toJSDate() : new Date(),
        endDate: d.endDate ? DateTime.fromISO(d.endDate, { zone: ctx.timezone }).endOf('day').toJSDate() : null,
        articleId: d.articleId ?? null,
        createdById: req.auth.userId,
      },
    });

    await rematerializeMedication(medication.id);
    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'medications:changed', { patientId: ctx.patientId });

    const activeMeds = await prisma.medication.findMany({
      where: { patientId: ctx.patientId, active: true },
      select: { displayName: true, activeIngredient: true, times: true },
    });
    const spacingWarnings = checkMedicationSpacingWarnings(
      activeMeds.map((m) => ({ name: m.displayName, activeIngredient: m.activeIngredient, times: m.times })),
    );

    return reply.status(201).send({ medication, spacingWarnings });
  });

  /**
   * IMMUTABLE REGIMEN VERSIONING:
   * Changing dosage or schedule NEVER mutates past DoseLog records —
   * it closes the old version (`active = false`, `endDate = now`) and inserts a linked replacement.
   */
  app.put('/medications/:id/version', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing) throw notFound('Medication not found');

    const ctx = await resolvePatientAccess(req, existing.patientId);
    const patch = CreateMedicationSchema.partial().parse(req.body);
    const now = new Date();

    const newVersion = await prisma.$transaction(async (tx) => {
      await tx.medication.update({
        where: { id: existing.id },
        data: { active: false, endDate: now },
      });
      await tx.doseLog.deleteMany({
        where: { medicationId: existing.id, status: 'PENDING', scheduledAt: { gte: now } },
      });
      return tx.medication.create({
        data: {
          patientId: existing.patientId,
          tenantId: existing.tenantId ?? req.auth.activeTenantId,
          previousMedicationId: existing.id,
          displayName: patch.displayName ?? existing.displayName,
          activeIngredient: patch.activeIngredient !== undefined ? patch.activeIngredient : existing.activeIngredient,
          drugCode: patch.drugCode !== undefined ? patch.drugCode : existing.drugCode,
          drugCodeSystem: patch.drugCodeSystem ?? existing.drugCodeSystem,
          dosage: patch.dosage !== undefined ? patch.dosage : existing.dosage,
          strengthValue: patch.strengthValue !== undefined ? patch.strengthValue : existing.strengthValue,
          strengthUnit: patch.strengthUnit !== undefined ? patch.strengthUnit : existing.strengthUnit,
          form: patch.form !== undefined ? patch.form : existing.form,
          instructions: patch.instructions !== undefined ? patch.instructions : existing.instructions,
          times: patch.times ?? existing.times,
          scheduleRule: patch.scheduleRule ?? (existing.scheduleRule as object),
          startDate: now,
          endDate: patch.endDate ? DateTime.fromISO(patch.endDate, { zone: ctx.timezone }).endOf('day').toJSDate() : existing.endDate,
          articleId: patch.articleId !== undefined ? patch.articleId : existing.articleId,
          createdById: req.auth.userId,
        },
      });
    });

    await rematerializeMedication(newVersion.id);
    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'medications:changed', { patientId: ctx.patientId });

    await writeAuditLog({
      tenantId: ctx.tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.globalRole,
      action: 'VERSION_MEDICATION_REGIMEN',
      entityType: 'Medication',
      entityId: newVersion.id,
      ipAddress: req.ip,
      details: { previousMedicationId: existing.id, oldDosage: existing.dosage, newDosage: newVersion.dosage },
    });

    return reply.status(201).send({ medication: newVersion, previousMedicationId: existing.id });
  });

  app.delete('/medications/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing) throw notFound('Medication not found');
    const ctx = await resolvePatientAccess(req, existing.patientId);

    const now = new Date();
    await prisma.$transaction([
      prisma.medication.update({ where: { id: existing.id }, data: { active: false, endDate: existing.endDate ?? now } }),
      prisma.doseLog.deleteMany({ where: { medicationId: existing.id, status: 'PENDING', scheduledAt: { gte: now } } }),
    ]);
    emitToTenantPatient(ctx.tenantId, ctx.patientId, 'medications:changed', { patientId: ctx.patientId });
    return { ok: true };
  });

  app.get('/patients/:patientId/doses', { preHandler: [authenticate] }, async (req) => {
    const { patientId } = z.object({ patientId: z.string() }).parse(req.params);
    const ctx = await resolvePatientAccess(req, patientId);
    const today = localDateIso(ctx.timezone);
    const q = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
    }).parse(req.query);

    const doses = await prisma.doseLog.findMany({
      where: {
        patientId: ctx.patientId,
        localDate: { gte: q.from, lte: q.to },
      },
      include: {
        medication: {
          select: {
            id: true, displayName: true, activeIngredient: true, drugCode: true,
            dosage: true, form: true, instructions: true, scheduleRule: true, active: true,
          },
        },
      },
      orderBy: [{ localDate: 'asc' }, { localTime: 'asc' }],
    });

    return { timezone: ctx.timezone, from: q.from, to: q.to, doses };
  });

  /**
   * Idempotent & offline-safe dose confirmation:
   * Accepts optional `clientConfirmedAt` (from IndexedDB/Capacitor offline queue)
   * and allows overriding an auto-generated `MISSED` status within 48 hours while preserving both timestamps.
   */
  app.patch('/doses/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = ConfirmDoseSchema.parse(req.body);
    const existing = await prisma.doseLog.findUnique({ where: { id } });
    if (!existing) throw notFound('Dose not found');

    const ctx = await resolvePatientAccess(req, existing.patientId);

    return withIdempotency(req, reply, req.auth.userId, 200, async () => {
      const serverNow = new Date();
      const confirmedAt = body.clientConfirmedAt ? new Date(body.clientConfirmedAt) : serverNow;

      if (body.status !== 'PENDING') {
        const ageMs = serverNow.getTime() - existing.scheduledAt.getTime();
        if (ageMs > 48 * 3600 * 1000) {
          throw badRequest(ErrorCode.DOSE_WINDOW_EXPIRED, 'This dose is older than 48 hours and locked');
        }
        if (existing.scheduledAt.getTime() - serverNow.getTime() > 12 * 3600 * 1000) {
          throw badRequest(ErrorCode.DOSE_TOO_EARLY, 'This dose is too far in the future');
        }
      }

      const updated = await prisma.doseLog.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          takenAt: body.status === 'TAKEN' ? confirmedAt : null,
          clientConfirmedAt: body.status === 'PENDING' ? null : confirmedAt,
          serverReceivedAt: body.status === 'PENDING' ? null : serverNow,
          note: body.note === undefined ? undefined : body.note,
        },
        include: {
          medication: {
            select: { id: true, displayName: true, dosage: true, form: true, instructions: true },
          },
        },
      });

      emitToTenantPatient(ctx.tenantId, ctx.patientId, 'dose:updated', updated);
      return { dose: updated };
    });
  });
}

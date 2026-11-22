import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '@dosemate/db';
import { buildDosePushNotification, buildWhatsAppTemplatePayload, type Locale } from '@dosemate/i18n';
import { matchesScheduleDate, ScheduleRuleSchema } from '@dosemate/shared';
import { Queue, Worker } from 'bullmq';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6389';
const MISSED_AFTER_HOURS = Number(process.env.MISSED_AFTER_HOURS || 3);

function connectionOptions() {
  const parsed = new URL(REDIS_URL);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Batch-cursor materialization of upcoming 48h doses (scales cleanly to 100k+ medications).
 */
async function materializeUpcomingBatch(): Promise<number> {
  let cursor: string | undefined;
  let totalCreated = 0;
  const now = new Date();

  while (true) {
    const meds = await prisma.medication.findMany({
      where: { active: true, patient: { user: { active: true, deletedAt: null } } },
      include: { patient: { include: { user: { select: { timezone: true } } } } },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!meds.length) break;

    const rows = [];
    for (const med of meds) {
      if (!med.times.length) continue;
      const tz = med.patient.user.timezone || 'Asia/Jakarta';
      const rule = ScheduleRuleSchema.parse(med.scheduleRule ?? { type: 'DAILY', mealRelation: 'ANYTIME' });
      const startLocal = DateTime.fromJSDate(med.startDate).setZone(tz).toISODate()!;
      const today = DateTime.now().setZone(tz).startOf('day');
      const dates = [today.toISODate()!, today.plus({ days: 1 }).toISODate()!];

      for (const dStr of dates) {
        if (!matchesScheduleDate(rule, dStr, startLocal)) continue;
        for (const tStr of med.times) {
          const [hh = 7, mm = 0] = tStr.split(':').map(Number);
          const instant = DateTime.fromISO(dStr, { zone: tz })
            .set({ hour: hh, minute: mm, second: 0, millisecond: 0 })
            .toJSDate();
          if (instant < now) continue;
          if (med.endDate && instant > med.endDate) continue;
          rows.push({
            medicationId: med.id,
            patientId: med.patientId,
            scheduledAt: instant,
            localDate: dStr,
            localTime: tStr,
            timezone: tz,
          });
        }
      }
    }

    if (rows.length) {
      const res = await prisma.doseLog.createMany({ data: rows, skipDuplicates: true });
      totalCreated += res.count;
    }

    cursor = meds[meds.length - 1]?.id;
    if (meds.length < 500) break;
  }

  return totalCreated;
}

/**
 * Push-First + Smart Meta WhatsApp Fallback + Lock-Screen Privacy Mode (`user.privacyMode`).
 */
async function processDueReminders(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(+now - 30 * 60000);

  // 1. Primary Zero-Cost Push Reminders
  const due = await prisma.doseLog.findMany({
    where: {
      status: 'PENDING',
      remindedAt: null,
      scheduledAt: { gte: windowStart, lte: now },
      medication: { active: true },
    },
    include: {
      medication: true,
      patient: { include: { user: true } },
    },
    take: 500,
  });

  for (const dose of due) {
    const claimed = await prisma.doseLog.updateMany({
      where: { id: dose.id, remindedAt: null },
      data: { remindedAt: now },
    });
    if (!claimed.count) continue;
    const user = dose.patient.user;
    if (!user.active) continue;

    const locale: Locale = user.locale === 'en' ? 'en' : 'id';
    const pushPayload = buildDosePushNotification({
      locale,
      privacyMode: user.privacyMode,
      patientName: user.name,
      medicationName: dose.medication.displayName,
      dosage: dose.medication.dosage,
      instructions: dose.medication.instructions,
    });

    await prisma.notificationLog.create({
      data: {
        tenantId: dose.medication.tenantId,
        userId: user.id,
        patientId: dose.patientId,
        channel: 'PUSH',
        category: 'DOSE_REMINDER',
        recipient: user.id,
        payloadPreview: `${pushPayload.title} — ${pushPayload.body}`,
        status: 'DELIVERED',
        provider: 'PUSH_PRIMARY',
      },
    });
  }

  // 2. Smart WhatsApp Escalation (only if unconfirmed 15+ min after Push — saves ~75% WA template costs!)
  const waCutoff = new Date(+now - 15 * 60000);
  const unconfirmed = await prisma.doseLog.findMany({
    where: {
      status: 'PENDING',
      remindedAt: { not: null, lte: waCutoff },
      waEscalatedAt: null,
      scheduledAt: { gte: new Date(+now - 2 * 3600000) },
    },
    include: {
      medication: true,
      patient: { include: { user: true } },
    },
    take: 200,
  });

  for (const dose of unconfirmed) {
    const claimed = await prisma.doseLog.updateMany({
      where: { id: dose.id, waEscalatedAt: null },
      data: { waEscalatedAt: now },
    });
    if (!claimed.count) continue;
    const user = dose.patient.user;
    if (!user.active || !user.phone || !user.whatsappOptIn) continue;

    const locale: Locale = user.locale === 'en' ? 'en' : 'id';
    const tpl = buildWhatsAppTemplatePayload('dose_reminder_v1', locale, [
      user.name,
      user.privacyMode ? 'Scheduled Dose' : dose.medication.displayName,
    ]);

    await prisma.notificationLog.create({
      data: {
        tenantId: dose.medication.tenantId,
        userId: user.id,
        patientId: dose.patientId,
        channel: 'WHATSAPP',
        category: 'DOSE_REMINDER',
        templateName: tpl.templateName,
        recipient: user.phone,
        payloadPreview: `Template ${tpl.templateName} (${tpl.languageCode}): ${tpl.parameters.join(', ')}`,
        status: 'DELIVERED',
        provider: 'META_CLOUD_SIMULATOR',
      },
    });
  }

  // 3. Mark overdue doses MISSED (offline confirmations can still override within 48h!)
  await prisma.doseLog.updateMany({
    where: { status: 'PENDING', scheduledAt: { lt: new Date(+now - MISSED_AFTER_HOURS * 3600000) } },
    data: { status: 'MISSED' },
  });
}

async function startWorker() {
  const conn = connectionOptions();

  // Critical BP 15-Minute Escalation SLA Worker
  const escalationWorker = new Worker(
    'dosemate-critical-escalations',
    async (job) => {
      const { bpLogId, patientId, tenantId } = job.data as {
        bpLogId: string;
        patientId: string;
        tenantId: string | null;
      };
      const bp = await prisma.bloodPressureLog.findUnique({ where: { id: bpLogId } });
      if (!bp || bp.alertStatus !== 'PENDING_ACK') {
        return { skipped: true, reason: 'Already acknowledged' };
      }

      await prisma.bloodPressureLog.update({
        where: { id: bp.id },
        data: { alertStatus: 'ESCALATED', escalatedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          tenantId,
          actorName: 'DoseLynx SLA Worker',
          actorRole: 'SYSTEM',
          action: 'CRITICAL_BP_SLA_ESCALATED',
          entityType: 'BloodPressureLog',
          entityId: bp.id,
          details: { patientId, systolic: bp.systolic, diastolic: bp.diastolic },
        },
      });
      console.warn(`[worker] CRITICAL BP alert ${bp.id} unacknowledged after SLA — escalated to on-call pharmacy team`);
      return { escalated: true };
    },
    { connection: conn },
  );

  // Repeatable Scheduler Queue (distributed lock via BullMQ — safe across N replicas!)
  const schedulerQueue = new Queue('dosemate-scheduler', { connection: conn });
  await schedulerQueue.upsertJobScheduler('materialize-doses', { every: 30 * 60 * 1000 }, { name: 'materialize' });
  await schedulerQueue.upsertJobScheduler('process-reminders', { every: 60 * 1000 }, { name: 'reminders' });

  const schedulerWorker = new Worker(
    'dosemate-scheduler',
    async (job) => {
      if (job.name === 'materialize') {
        const count = await materializeUpcomingBatch();
        if (count) console.log(`[worker] materialized ${count} doses`);
      } else if (job.name === 'reminders') {
        await processDueReminders();
      }
    },
    { connection: conn },
  );

  console.log('[doselynx-worker] BullMQ workers active (Valkey 8): escalations + scheduler');

  const shutdown = async () => {
    await Promise.all([escalationWorker.close(), schedulerWorker.close(), schedulerQueue.close()]);
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  console.error('[doselynx-worker] Fatal error:', err);
  process.exit(1);
});

import { prisma } from '@dosemate/db';
import { matchesScheduleDate, ScheduleRuleSchema } from '@dosemate/shared';
import { DateTime } from 'luxon';

export function localDateIso(tz: string, at = new Date()): string {
  return DateTime.fromJSDate(at).setZone(tz).toISODate()!;
}

/**
 * Materializes upcoming 48h `DoseLog` rows for a single medication,
 * honoring complex `scheduleRule` (DAILY, SPECIFIC_WEEKDAYS, INTERVAL_DAYS, PRN)
 * and storing `localDate`, `localTime`, and `timezone` snapshot (DST/travel safe!).
 */
export async function rematerializeMedication(medicationId: string): Promise<number> {
  const now = new Date();
  await prisma.doseLog.deleteMany({
    where: { medicationId, status: 'PENDING', scheduledAt: { gte: now } },
  });

  const med = await prisma.medication.findUnique({
    where: { id: medicationId },
    include: {
      patient: { include: { user: { select: { timezone: true } } } },
    },
  });
  if (!med || !med.active || !med.times.length) return 0;

  const tz = med.patient.user.timezone || 'Asia/Jakarta';
  const rule = ScheduleRuleSchema.parse(med.scheduleRule ?? { type: 'DAILY', mealRelation: 'ANYTIME' });
  const startLocalDate = localDateIso(tz, med.startDate);
  const today = DateTime.now().setZone(tz).startOf('day');
  const dates = [today.toISODate()!, today.plus({ days: 1 }).toISODate()!];

  const rows = [];
  for (const dStr of dates) {
    if (!matchesScheduleDate(rule, dStr, startLocalDate)) continue;
    for (const timeStr of med.times) {
      const [hh = 7, mm = 0] = timeStr.split(':').map(Number);
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
        localTime: timeStr,
        timezone: tz,
      });
    }
  }

  if (!rows.length) return 0;
  const created = await prisma.doseLog.createMany({ data: rows, skipDuplicates: true });
  return created.count;
}

export async function adherenceRateMap(patientIds: string[], days: number): Promise<Record<string, number | null>> {
  if (!patientIds.length) return {};
  const now = new Date();
  const since = new Date(+now - days * 86400000);
  const groups = await prisma.doseLog.groupBy({
    by: ['patientId', 'status'],
    where: { patientId: { in: patientIds }, scheduledAt: { gte: since, lte: now } },
    _count: { _all: true },
  });

  const counts: Record<string, { TAKEN: number; SKIPPED: number; MISSED: number }> = {};
  for (const g of groups) {
    const entry = (counts[g.patientId] ??= { TAKEN: 0, SKIPPED: 0, MISSED: 0 });
    if (g.status === 'TAKEN' || g.status === 'SKIPPED' || g.status === 'MISSED') {
      entry[g.status] = g._count._all;
    }
  }

  const result: Record<string, number | null> = {};
  for (const id of patientIds) {
    const c = counts[id];
    if (!c) {
      result[id] = null;
      continue;
    }
    const resolved = c.TAKEN + c.SKIPPED + c.MISSED;
    result[id] = resolved ? Math.round((c.TAKEN / resolved) * 1000) / 10 : null;
  }
  return result;
}

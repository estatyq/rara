import { DateTime } from 'luxon';
import { prisma } from './db.js';
import { config } from './config.js';
import { addDays, localDate, zonedInstant } from './time.js';

const tzOf = (patient) => patient?.user?.timezone || config.defaultTimezone;

/**
 * Creates PENDING dose rows for the given local dates. Rows are materialized up front
 * so that adherence history stays stable even if the schedule is edited later.
 */
export async function materializeForMedication(med, tz, dates, notBefore = med.createdAt) {
  if (!med.active || !med.times?.length) return 0;
  const lower = Math.max(+med.startDate, +med.createdAt, +notBefore);
  const rows = [];
  for (const d of dates) {
    for (const t of med.times) {
      const at = zonedInstant(d, t, tz);
      if (+at < lower) continue;
      if (med.endDate && +at > +med.endDate) continue;
      rows.push({ medicationId: med.id, patientId: med.patientId, scheduledAt: at });
    }
  }
  if (!rows.length) return 0;
  const res = await prisma.doseLog.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

const upcomingDates = (tz) => {
  const today = localDate(tz);
  return [today, addDays(today, 1)];
};

export async function materializeAll() {
  const meds = await prisma.medication.findMany({
    where: { active: true, patient: { user: { active: true } } },
    include: { patient: { include: { user: { select: { timezone: true } } } } },
  });
  let created = 0;
  for (const med of meds) {
    const tz = tzOf(med.patient);
    created += await materializeForMedication(med, tz, upcomingDates(tz));
  }
  return created;
}

/** Call after a medication was created/edited: rebuilds its future pending doses. */
export async function rematerializeMedication(medicationId) {
  const now = new Date();
  await prisma.doseLog.deleteMany({ where: { medicationId, status: 'PENDING', scheduledAt: { gte: now } } });
  const med = await prisma.medication.findUnique({
    where: { id: medicationId },
    include: { patient: { include: { user: { select: { timezone: true } } } } },
  });
  if (!med || !med.active) return;
  const tz = tzOf(med.patient);
  await materializeForMedication(med, tz, upcomingDates(tz), now);
}

/** Rebuild future doses for all medications of a patient (e.g. after a timezone change). */
export async function rematerializePatient(patientId) {
  const meds = await prisma.medication.findMany({ where: { patientId }, select: { id: true } });
  for (const m of meds) await rematerializeMedication(m.id);
}

const emptyCounts = () => ({ TAKEN: 0, SKIPPED: 0, MISSED: 0, PENDING: 0 });

export const rateOf = (c) => {
  const resolved = c.TAKEN + c.SKIPPED + c.MISSED;
  return resolved ? Math.round((c.TAKEN / resolved) * 1000) / 10 : null;
};

/** Adherence statistics for the last `days` local days (only doses whose time has passed). */
export async function adherenceFor(patientId, tz, days = 30) {
  const now = new Date();
  const start = DateTime.now().setZone(tz).startOf('day').minus({ days: days - 1 });
  const logs = await prisma.doseLog.findMany({
    where: { patientId, scheduledAt: { gte: start.toJSDate(), lte: now } },
    select: { status: true, scheduledAt: true, takenAt: true, medicationId: true, medication: { select: { name: true } } },
  });

  const total = emptyCounts();
  const byDay = new Map();
  const byMed = new Map();
  for (let i = 0; i < days; i++) byDay.set(start.plus({ days: i }).toISODate(), emptyCounts());

  let delaySum = 0;
  let delayN = 0;
  for (const l of logs) {
    total[l.status]++;
    const day = localDate(tz, l.scheduledAt);
    byDay.get(day) && byDay.get(day)[l.status]++;
    if (!byMed.has(l.medicationId)) byMed.set(l.medicationId, { medicationId: l.medicationId, name: l.medication.name, ...emptyCounts() });
    byMed.get(l.medicationId)[l.status]++;
    if (l.status === 'TAKEN' && l.takenAt) {
      delaySum += (l.takenAt - l.scheduledAt) / 60000;
      delayN++;
    }
  }

  return {
    days,
    counts: total,
    rate: rateOf(total),
    avgDelayMinutes: delayN ? Math.round(delaySum / delayN) : null,
    daily: [...byDay.entries()].map(([date, c]) => ({ date, ...c, rate: rateOf(c) })),
    byMedication: [...byMed.values()].map((m) => ({ ...m, rate: rateOf(m) })),
  };
}

/** 7/30-day adherence rates for many patients in two queries. */
export async function adherenceRates(patientIds, days) {
  if (!patientIds.length) return {};
  const now = new Date();
  const since = new Date(+now - days * 86400000);
  const groups = await prisma.doseLog.groupBy({
    by: ['patientId', 'status'],
    where: { patientId: { in: patientIds }, scheduledAt: { gte: since, lte: now } },
    _count: { _all: true },
  });
  const map = {};
  for (const g of groups) {
    map[g.patientId] ??= emptyCounts();
    map[g.patientId][g.status] = g._count._all;
  }
  const out = {};
  for (const id of patientIds) out[id] = map[id] ? rateOf(map[id]) : null;
  return out;
}

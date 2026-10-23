import { DateTime, IANAZone } from 'luxon';

export const INDONESIA_TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'];

export const isValidTimezone = (tz) => typeof tz === 'string' && IANAZone.isValidZone(tz);

export const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && DateTime.fromISO(d).isValid;

/** "YYYY-MM-DD" for the given instant in the timezone. */
export function localDate(tz, at = new Date()) {
  return DateTime.fromJSDate(at).setZone(tz).toISODate();
}

export function addDays(dateStr, days) {
  return DateTime.fromISO(dateStr).plus({ days }).toISODate();
}

/** Instant for a local date + "HH:mm" in a timezone. */
export function zonedInstant(dateStr, timeStr, tz) {
  const [h, m] = timeStr.split(':').map(Number);
  return DateTime.fromISO(dateStr, { zone: tz }).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
}

export function startOfLocalDay(dateStr, tz) {
  return DateTime.fromISO(dateStr, { zone: tz }).startOf('day').toJSDate();
}

export function endOfLocalDay(dateStr, tz) {
  return DateTime.fromISO(dateStr, { zone: tz }).endOf('day').toJSDate();
}

export function formatLocal(at, tz, fmt = 'yyyy-MM-dd HH:mm') {
  if (!at) return '';
  return DateTime.fromJSDate(at).setZone(tz).toFormat(fmt);
}

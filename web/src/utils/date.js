function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** Value suitable for <input type="datetime-local"> in the patient's timezone. */
export function dateTimeInputInZone(date = new Date(), timeZone = 'Asia/Jakarta') {
  const parts = partsInZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Interpret a datetime-local value as a wall-clock time in a specific IANA zone. */
export function localDateTimeToISO(value, timeZone = 'Asia/Jakarta') {
  const naive = new Date(`${value}:00Z`);
  const parts = partsInZone(naive, timeZone);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = representedAsUtc - naive.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

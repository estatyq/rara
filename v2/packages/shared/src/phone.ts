import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Global E.164 phone normalization supporting any country (Indonesia default 'ID').
 * Returns normalized E.164 string (e.g. "+6281234567890", "+6591234567", "+14155552671") or null if invalid.
 */
export function normalizeInternationalPhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = 'ID',
): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Formats ISO 4217 currency from integer minor units (or whole units for zero-decimal currencies like IDR/JPY).
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['IDR', 'JPY', 'KRW', 'VND']);

export function formatMoney(
  amountMinor: number,
  currency = 'IDR',
  locale: 'id' | 'en' = 'id',
): string {
  const code = currency.toUpperCase();
  const value = ZERO_DECIMAL_CURRENCIES.has(code) ? amountMinor : amountMinor / 100;
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2,
  }).format(value);
}

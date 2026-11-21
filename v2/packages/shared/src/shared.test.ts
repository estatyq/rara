import { describe, expect, it } from 'vitest';
import {
  BpCategory,
  checkMedicationSpacingWarnings,
  classifyBloodPressure,
  computeMeanArterialPressure,
  formatMoney,
  isBpControlled,
  matchesScheduleDate,
  normalizeInternationalPhone,
  summarizeBloodPressures,
} from './index.js';

describe('@dosemate/shared clinical & global utilities', () => {
  it('classifies blood pressure accurately across pregnancy/hypertension thresholds', () => {
    expect(classifyBloodPressure(118, 76)).toBe(BpCategory.NORMAL);
    expect(classifyBloodPressure(134, 84)).toBe(BpCategory.ELEVATED);
    expect(classifyBloodPressure(142, 91)).toBe(BpCategory.HIGH);
    expect(classifyBloodPressure(165, 112)).toBe(BpCategory.CRITICAL);
    expect(classifyBloodPressure(86, 56)).toBe(BpCategory.LOW);
    expect(isBpControlled({ systolic: 139, diastolic: 89 })).toBe(true);
    expect(isBpControlled({ systolic: 140, diastolic: 82 })).toBe(false);
    expect(computeMeanArterialPressure(120, 80)).toBe(93);
  });

  it('summarizes blood pressure readings cleanly', () => {
    const summary = summarizeBloodPressures([
      { systolic: 120, diastolic: 80, measuredAt: '2026-11-20T01:00:00Z' },
      { systolic: 150, diastolic: 95, measuredAt: '2026-11-21T01:00:00Z' },
    ]);
    expect(summary.count).toBe(2);
    expect(summary.latest?.systolic).toBe(150);
    expect(summary.latest?.category).toBe(BpCategory.HIGH);
    expect(summary.controlRate).toBe(50);
  });

  it('normalizes international phone numbers across multiple countries', () => {
    expect(normalizeInternationalPhone('0812-3456-7890', 'ID')).toBe('+6281234567890');
    expect(normalizeInternationalPhone('+65 9123 4567', 'ID')).toBe('+6591234567');
    expect(normalizeInternationalPhone('(415) 555-2671', 'US')).toBe('+14155552671');
    expect(normalizeInternationalPhone('123', 'ID')).toBeNull();
  });

  it('formats ISO 4217 currencies cleanly', () => {
    expect(formatMoney(50000, 'IDR', 'id')).toContain('50.000');
    expect(formatMoney(1999, 'USD', 'en')).toBe('$19.99');
  });

  it('evaluates complex therapy schedule rules (daily, weekdays, interval, PRN)', () => {
    expect(matchesScheduleDate({ type: 'DAILY', mealRelation: 'ANYTIME' }, '2026-11-22', '2026-11-20')).toBe(true);
    expect(matchesScheduleDate({ type: 'PRN', mealRelation: 'ANYTIME' }, '2026-11-22', '2026-11-20')).toBe(false);
    // 2026-11-23 is Monday (ISO weekday 1)
    expect(
      matchesScheduleDate({ type: 'SPECIFIC_WEEKDAYS', weekdays: [1, 3, 5], mealRelation: 'AFTER_MEAL' }, '2026-11-23', '2026-11-20'),
    ).toBe(true);
    expect(
      matchesScheduleDate({ type: 'SPECIFIC_WEEKDAYS', weekdays: [1, 3, 5], mealRelation: 'AFTER_MEAL' }, '2026-11-24', '2026-11-20'),
    ).toBe(false);
    // Every 2 days starting 2026-11-20 -> 20, 22, 24 match; 21, 23 do not
    expect(
      matchesScheduleDate({ type: 'INTERVAL_DAYS', intervalDays: 2, mealRelation: 'ANYTIME' }, '2026-11-22', '2026-11-20'),
    ).toBe(true);
    expect(
      matchesScheduleDate({ type: 'INTERVAL_DAYS', intervalDays: 2, mealRelation: 'ANYTIME' }, '2026-11-23', '2026-11-20'),
    ).toBe(false);
  });

  it('detects Calcium + Iron spacing conflict under 120 minutes', () => {
    const warnings = checkMedicationSpacingWarnings([
      { name: 'Suplemen Kalsium', activeIngredient: 'Calcium carbonate', times: ['07:00', '19:00'] },
      { name: 'Tablet Tambah Darah', activeIngredient: 'Ferrous fumarate', times: ['07:30'] },
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('CALCIUM_IRON_SPACING');
    expect(warnings[0]?.actualGapMinutes).toBe(30);
  });
});

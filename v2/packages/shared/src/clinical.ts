import { z } from 'zod';

export const BpCategory = {
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  LOW: 'LOW',
} as const;

export type BpCategoryType = (typeof BpCategory)[keyof typeof BpCategory];

/**
 * Informational triage ranges aligned with POGI / WHO / ESC pregnancy & hypertension guidelines.
 * Strictly Non-SaMD: supports self-tracking & pharmacist communication, NOT an automated diagnosis.
 */
export const CLINICAL_GUIDELINE_CITATIONS = {
  bpPregnancy: {
    en: 'Reference ranges adapted from WHO (2020), ESC (2024), and POGI (Indonesia) gestational hypertension & preeclampsia guidelines. Informational only; not a medical diagnosis.',
    id: 'Rentang acuan mengacu pada pedoman WHO (2020), ESC (2024), dan POGI (PNPK Preeklampsia). Bersifat informatif untuk pemantauan bersama apoteker/dokter dan bukan diagnosis medis.',
  },
} as const;

export function classifyBloodPressure(systolic: number, diastolic: number): BpCategoryType {
  if (systolic >= 160 || diastolic >= 110) return BpCategory.CRITICAL;
  if (systolic >= 140 || diastolic >= 90) return BpCategory.HIGH;
  if (systolic < 90 || diastolic < 60) return BpCategory.LOW;
  if (systolic < 130 && diastolic < 85) return BpCategory.NORMAL;
  return BpCategory.ELEVATED;
}

export function isBpControlled(log: { systolic: number; diastolic: number }): boolean {
  return log.systolic < 140 && log.diastolic < 90;
}

export function computeMeanArterialPressure(systolic: number, diastolic: number): number {
  return Math.round((systolic + 2 * diastolic) / 3);
}

export interface BpLogLike {
  systolic: number;
  diastolic: number;
  measuredAt: Date | string;
}

export function summarizeBloodPressures<T extends BpLogLike>(logs: T[], days = 30) {
  const ordered = [...logs].sort((a, b) => +new Date(b.measuredAt) - +new Date(a.measuredAt));
  const latest = ordered[0] ?? null;
  const count = ordered.length;
  const controlledCount = ordered.filter(isBpControlled).length;

  const average = count
    ? {
        systolic: Math.round(ordered.reduce((sum, l) => sum + l.systolic, 0) / count),
        diastolic: Math.round(ordered.reduce((sum, l) => sum + l.diastolic, 0) / count),
      }
    : null;

  const categories: Record<BpCategoryType, number> = {
    NORMAL: 0,
    ELEVATED: 0,
    HIGH: 0,
    CRITICAL: 0,
    LOW: 0,
  };
  for (const log of ordered) {
    categories[classifyBloodPressure(log.systolic, log.diastolic)] += 1;
  }

  return {
    days,
    count,
    latest: latest
      ? {
          ...latest,
          category: classifyBloodPressure(latest.systolic, latest.diastolic),
          controlled: isBpControlled(latest),
          map: computeMeanArterialPressure(latest.systolic, latest.diastolic),
        }
      : null,
    average,
    controlledCount,
    controlRate: count ? Math.round((controlledCount / count) * 100) : null,
    categories,
  };
}

// ---- Complex Therapy Regimen Schedule Rules (Section D) ----

export const ScheduleRuleTypeSchema = z.enum([
  'DAILY',
  'SPECIFIC_WEEKDAYS',
  'INTERVAL_DAYS',
  'PRN',
]);

export const MealRelationSchema = z.enum([
  'ANYTIME',
  'BEFORE_MEAL',
  'WITH_MEAL',
  'AFTER_MEAL',
  'BEDTIME',
]);

export const ScheduleRuleSchema = z.object({
  type: ScheduleRuleTypeSchema.default('DAILY'),
  /** ISO weekdays 1=Mon..7=Sun, used when type === 'SPECIFIC_WEEKDAYS' */
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  /** Interval in days (e.g. 2 = every other day, 7 = weekly), used when type === 'INTERVAL_DAYS' */
  intervalDays: z.number().int().min(1).max(90).optional(),
  mealRelation: MealRelationSchema.default('ANYTIME'),
});

export type ScheduleRule = z.infer<typeof ScheduleRuleSchema>;

/**
 * Checks whether a local date ("YYYY-MM-DD") should have materialized doses under `rule`.
 */
export function matchesScheduleDate(
  rule: ScheduleRule,
  localDateIso: string,
  startDateIso: string,
): boolean {
  if (rule.type === 'PRN') return false;
  if (localDateIso < startDateIso) return false;
  if (rule.type === 'DAILY') return true;

  const target = new Date(`${localDateIso}T00:00:00Z`);
  if (rule.type === 'SPECIFIC_WEEKDAYS') {
    const jsDay = target.getUTCDay(); // 0=Sun..6=Sat
    const isoDay = jsDay === 0 ? 7 : jsDay;
    return Boolean(rule.weekdays?.includes(isoDay));
  }

  if (rule.type === 'INTERVAL_DAYS') {
    const start = new Date(`${startDateIso}T00:00:00Z`);
    const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000);
    const interval = rule.intervalDays ?? 1;
    return diffDays >= 0 && diffDays % interval === 0;
  }

  return true;
}

export interface SpacingWarning {
  code: 'CALCIUM_IRON_SPACING' | 'CALCIUM_LEVOTHYROXINE_SPACING';
  medA: string;
  medB: string;
  minGapMinutes: number;
  actualGapMinutes: number;
}

function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Detects classic absorption spacing conflicts in maternal/chronic therapy
 * (e.g. Calcium taken within 2 hours of Iron/Fe or Levothyroxine).
 */
export function checkMedicationSpacingWarnings(
  meds: Array<{ name: string; activeIngredient?: string | null; times: string[] }>,
): SpacingWarning[] {
  const warnings: SpacingWarning[] = [];
  const isMatch = (m: { name: string; activeIngredient?: string | null }, re: RegExp) =>
    re.test(m.name) || (m.activeIngredient ? re.test(m.activeIngredient) : false);

  const calciumMeds = meds.filter((m) => isMatch(m, /calcium|kalsium/i));
  const ironMeds = meds.filter((m) => isMatch(m, /\b(iron|ferrous|fero|zat besi|tablet tambah darah|fe)\b/i));
  const levoMeds = meds.filter((m) => isMatch(m, /levothyroxine|levotiroksin|euthyrox/i));

  const checkPair = (
    listA: typeof meds,
    listB: typeof meds,
    code: SpacingWarning['code'],
    minGap: number,
  ) => {
    for (const a of listA) {
      for (const b of listB) {
        if (a === b) continue;
        for (const ta of a.times) {
          for (const tb of b.times) {
            const gap = Math.abs(toMinutes(ta) - toMinutes(tb));
            if (gap < minGap) {
              warnings.push({
                code,
                medA: a.name,
                medB: b.name,
                minGapMinutes: minGap,
                actualGapMinutes: gap,
              });
            }
          }
        }
      }
    }
  };

  checkPair(calciumMeds, ironMeds, 'CALCIUM_IRON_SPACING', 120);
  checkPair(calciumMeds, levoMeds, 'CALCIUM_LEVOTHYROXINE_SPACING', 240);
  return warnings;
}

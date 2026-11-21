export const BP_LABELS = {
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
  LOW: 'LOW',
};

/**
 * A deliberately simple triage classification for the study UI.
 * It is not a diagnosis and does not replace clinical assessment.
 */
export function classifyBloodPressure(systolic, diastolic) {
  if (systolic >= 160 || diastolic >= 110) return BP_LABELS.CRITICAL;
  if (systolic >= 140 || diastolic >= 90) return BP_LABELS.HIGH;
  if (systolic < 90 || diastolic < 60) return BP_LABELS.LOW;
  if (systolic < 130 && diastolic < 85) return BP_LABELS.NORMAL;
  return BP_LABELS.ELEVATED;
}

export const isControlled = (log) => log.systolic < 140 && log.diastolic < 90;

export function summarizeBloodPressures(logs, days = 30) {
  const ordered = [...logs].sort((a, b) => +b.measuredAt - +a.measuredAt);
  const latest = ordered[0] || null;
  const count = ordered.length;
  const controlledCount = ordered.filter(isControlled).length;
  const avg = count
    ? {
        systolic: Math.round(ordered.reduce((sum, log) => sum + log.systolic, 0) / count),
        diastolic: Math.round(ordered.reduce((sum, log) => sum + log.diastolic, 0) / count),
      }
    : null;

  const categories = {
    NORMAL: 0,
    ELEVATED: 0,
    HIGH: 0,
    CRITICAL: 0,
    LOW: 0,
  };
  for (const log of ordered) categories[classifyBloodPressure(log.systolic, log.diastolic)] += 1;

  return {
    days,
    count,
    latest: latest
      ? {
          ...latest,
          category: classifyBloodPressure(latest.systolic, latest.diastolic),
          controlled: isControlled(latest),
        }
      : null,
    average: avg,
    controlledCount,
    controlRate: count ? Math.round((controlledCount / count) * 100) : null,
    categories,
  };
}

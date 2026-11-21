import { describe, expect, it } from 'vitest';
import { buildBpAlertText, buildDosePushNotification, enResources, idResources } from './index.js';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

describe('@dosemate/i18n key parity & PHI privacy', () => {
  it('guarantees 100% key parity between Indonesian (id) and English (en)', () => {
    const idKeys = flattenKeys(idResources as unknown as Record<string, unknown>);
    const enKeys = flattenKeys(enResources as unknown as Record<string, unknown>);
    expect(enKeys).toEqual(idKeys);
    expect(idKeys.length).toBeGreaterThan(80);
  });

  it('hides medication names and BP numbers when lock-screen privacyMode is enabled', () => {
    const push = buildDosePushNotification({
      locale: 'en',
      privacyMode: true,
      patientName: 'Siti',
      medicationName: 'Methyldopa',
      dosage: '250 mg',
    });
    expect(push.body).not.toContain('Methyldopa');
    expect(push.body).not.toContain('250 mg');

    const bpText = buildBpAlertText({
      locale: 'id',
      privacyMode: true,
      patientName: 'Siti',
      systolic: 170,
      diastolic: 112,
      category: 'CRITICAL',
    });
    expect(bpText).not.toContain('170');
    expect(bpText).not.toContain('112');
  });
});

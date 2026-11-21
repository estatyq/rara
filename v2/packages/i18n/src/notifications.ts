export type Locale = 'id' | 'en';

export interface DoseNotificationInput {
  locale: Locale;
  privacyMode: boolean;
  patientName: string;
  medicationName: string;
  dosage?: string | null;
  instructions?: string | null;
}

export interface BpAlertNotificationInput {
  locale: Locale;
  privacyMode: boolean;
  patientName: string;
  systolic: number;
  diastolic: number;
  category: 'HIGH' | 'CRITICAL';
}

/**
 * Generates Push & WhatsApp notification payloads while strictly enforcing
 * Lock-Screen PHI Privacy (`privacyMode === true` omits drug names and medical values).
 */
export function buildDosePushNotification(input: DoseNotificationInput) {
  if (input.privacyMode) {
    return input.locale === 'en'
      ? {
          title: 'DoseMate Reminder',
          body: 'You have a scheduled health reminder. Open DoseMate to confirm.',
          actionTaken: 'Confirm',
          actionOpen: 'Open',
        }
      : {
          title: 'Pengingat DoseMate',
          body: 'Anda memiliki jadwal kesehatan. Buka DoseMate untuk konfirmasi.',
          actionTaken: 'Konfirmasi',
          actionOpen: 'Buka',
        };
  }

  return input.locale === 'en'
    ? {
        title: 'Time to take your medicine 💊',
        body: `${input.medicationName}${input.dosage ? ` (${input.dosage})` : ''}. Tap to confirm.`,
        actionTaken: 'Taken',
        actionOpen: 'Open',
      }
    : {
        title: 'Waktunya minum obat 💊',
        body: `${input.medicationName}${input.dosage ? ` (${input.dosage})` : ''}. Ketuk untuk konfirmasi.`,
        actionTaken: 'Sudah diminum',
        actionOpen: 'Buka',
      };
}

export function buildWhatsAppTemplatePayload(
  templateName: 'dose_reminder_v1' | 'bp_critical_alert_v1' | 'checkup_reminder_v1' | 'otp_verify_v1',
  locale: Locale,
  parameters: string[],
) {
  return {
    templateName,
    languageCode: locale === 'en' ? 'en_US' : 'id',
    parameters,
  };
}

export function buildBpAlertText(input: BpAlertNotificationInput): string {
  if (input.privacyMode) {
    return input.locale === 'en'
      ? `[DoseMate] Hello ${input.patientName}, an important health reading requires your attention. Please open DoseMate or contact your pharmacist.`
      : `[DoseMate] Halo ${input.patientName}, terdapat hasil pemantauan kesehatan yang memerlukan perhatian. Silakan buka DoseMate atau hubungi apoteker Anda.`;
  }

  if (input.locale === 'en') {
    const urgency =
      input.category === 'CRITICAL'
        ? 'Please seek immediate medical evaluation or contact your clinical pharmacist.'
        : 'Please rest quietly, re-measure in 15 minutes, and consult your pharmacist.';
    return `[DoseMate Alert] Hello ${input.patientName}, your blood pressure reading (${input.systolic}/${input.diastolic} mmHg) is classified as ${input.category}. ${urgency}`;
  }

  const urgency =
    input.category === 'CRITICAL'
      ? 'Segera cari pertolongan medis di fasilitas kesehatan terdekat atau hubungi apoteker Anda.'
      : 'Silakan istirahat tenang, ukur ulang 15 menit lagi, dan konsultasikan dengan apoteker Anda.';
  return `[Peringatan DoseMate] Halo ${input.patientName}, tekanan darah Anda (${input.systolic}/${input.diastolic} mmHg) masuk kategori ${input.category === 'CRITICAL' ? 'KRITIS' : 'TINGGI'}. ${urgency}`;
}

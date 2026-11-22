/**
 * Bidirectional localization dictionary and helper for seeded clinical demo data.
 * Allows existing Indonesian database rows (e.g., Patient.diagnosis, medications,
 * follow-ups, sample messages, and check-up reminders) to render naturally in both
 * English ('en') and Indonesian ('id') when toggling language, while leaving custom
 * user-entered text untouched.
 */
export const SEED_TEXT_PAIRS = [
  // Admin & Staff display names
  ['Admin Sistem Farmasi', 'Pharmacy System Admin'],

  // Pharmacist profiles (workplace, specialization, verification notes)
  [
    'Instalasi Farmasi Klinis RSIA & Puskesmas Mitra',
    'Clinical Pharmacy Dept., Partner Maternal Hospital & Clinic',
  ],
  [
    'Farmasi Klinis, Kehamilan Risiko Tinggi & Preeklampsia',
    'Clinical Pharmacy, High-Risk Pregnancy & Preeclampsia',
  ],
  ['Farmasi Klinis & Kehamilan', 'Clinical Pharmacy & Maternal Care'],
  ['Farmasi Klinis', 'Clinical Pharmacy'],
  [
    'Kredensial STRA dan SIPA terverifikasi resmi oleh Administrator.',
    'STRA and SIPA credentials officially verified by Administrator.',
  ],
  [
    'Klinik Pratama & Apotek Sehat Bersama',
    'Primary Care Clinic & Sehat Bersama Pharmacy',
  ],
  [
    'Pelayanan Informasi Obat & Konseling Terapi Kronis',
    'Drug Information Service & Chronic Therapy Counseling',
  ],

  // Patient diagnoses (Patient.diagnosis)
  [
    'Kehamilan risiko tinggi, hipertensi kronis ringan',
    'High-risk pregnancy, mild chronic hypertension',
  ],
  [
    'Hipertensi gestasional, pemantauan risiko preeklampsia',
    'Gestational hypertension, preeclampsia risk monitoring',
  ],
  [
    'Hipertensi kronis pada kehamilan trimester II',
    'Chronic hypertension in second-trimester pregnancy',
  ],
  [
    'Kehamilan risiko preeklampsia ringan — terapi profilaksis',
    'Mild preeclampsia risk pregnancy — prophylaxis therapy',
  ],

  // Patient allergies, risk factors, and clinical notes
  ['Tidak ada alergi obat yang diketahui', 'No known drug allergies'],
  [
    'Hipertensi kronis; riwayat preeklampsia pada kehamilan sebelumnya',
    'Chronic hypertension; history of preeclampsia in previous pregnancy',
  ],
  [
    'Peserta penelitian pemantauan apoteker melalui aplikasi. Perlu evaluasi kepatuhan dan tekanan darah setiap minggu.',
    'App-based pharmacist monitoring participant. Requires weekly adherence and blood pressure review.',
  ],

  // Seeded medication names
  ['Aspirin dosis rendah', 'Low-dose Aspirin'],
  ['Suplemen kalsium', 'Calcium Supplement'],
  ['Metildopa', 'Methyldopa'],

  // Seeded medication instructions
  [
    'Ikuti dosis dan waktu yang diresepkan. Jangan mengubah dosis sendiri.',
    'Follow the prescribed dose and timing. Do not adjust the dose on your own.',
  ],
  [
    'Ikuti rekomendasi petugas kesehatan dan catat keluhan yang muncul.',
    'Follow your healthcare provider’s advice and record any symptoms.',
  ],
  [
    'Minum rutin sesuai jadwal alarm DoseLynx.',
    'Take regularly according to your DoseLynx alarm schedule.',
  ],

  // Blood pressure & health parameter notes
  ['Duduk tenang, diukur sebelum sarapan.', 'Seated calmly, measured before breakfast.'],
  [
    'Kenaikan berat badan stabil sesuai usia kehamilan.',
    'Steady weight gain consistent with gestational age.',
  ],
  ['Gerakan janin aktif setelah makan malam.', 'Active fetal movement after dinner.'],

  // Check-up reminders (title, location, notes)
  [
    'Kontrol Antenatal (ANC) & Evaluasi Tekanan Darah',
    'Antenatal Check-Up (ANC) & Blood Pressure Review',
  ],
  ['Poli Obgyn RSIA Mitra', 'OB/GYN Clinic, Partner Maternal Hospital'],
  [
    'Bawa catatan tekanan darah 2 minggu terakhir dari aplikasi DoseLynx.',
    'Bring your last 2 weeks of blood pressure logs from the DoseLynx app.',
  ],
  [
    'Tindak Lanjut Pemantauan Terapi Obat (PTO)',
    'Pharmacotherapy Monitoring Follow-Up (PTO)',
  ],
  ['Telefarmasi DoseLynx', 'DoseLynx Telepharmacy'],
  [
    'Evaluasi kepatuhan aspirin dosis rendah dan suplemen kalsium.',
    'Review adherence to low-dose aspirin and calcium supplements.',
  ],
  ['Pengambilan Ulang Obat (Refill Resep)', 'Prescription Medication Refill'],
  ['Instalasi Farmasi Klinis', 'Clinical Pharmacy Department'],
  [
    'Siapkan sisa blister obat untuk rekonsiliasi.',
    'Prepare remaining medication blister packs for reconciliation.',
  ],

  // Service requests (complaint, pharmacistReply)
  [
    'Ingin evaluasi jadwal minum kalsium dan aspirin serta tinjauan hasil tekanan darah minggu ini.',
    'Would like to review my calcium and aspirin schedule and this week’s blood pressure readings.',
  ],
  [
    'Jadwal evaluasi PTO telah dikonfirmasi. Pastikan mencatat tekanan darah pagi sebelum sesi konsultasi.',
    'Your PTO evaluation appointment is confirmed. Please record your morning blood pressure before the consultation.',
  ],

  // Follow-up / PTO SOAP report (subjective, objective, assessment, plan, recommendation)
  [
    'Pasien melaporkan tidak ada sakit kepala hebat atau gangguan penglihatan. Kadang lupa dosis kalsium malam hari bila kelelahan.',
    'Patient reports no severe headache or visual disturbances. Occasionally misses the evening calcium dose when fatigued.',
  ],
  [
    'TD rata-rata 7 hari terakhir: 126/79 mmHg (Terkontrol <140/90 mmHg). Kepatuhan minum obat 30 hari ~85%.',
    '7-day average BP: 126/79 mmHg (Controlled <140/90 mmHg). 30-day medication adherence ~85%.',
  ],
  [
    'Terapi profilaksis preeklampsia (Aspirin 80 mg 1x1 & Kalsium 500 mg 2x1) efektif dan ditoleransi baik. Ditemukan risiko ketidakpatuhan ringan pada dosis malam.',
    'Preeclampsia prophylaxis therapy (Aspirin 80 mg once daily & Calcium 500 mg twice daily) is effective and well tolerated. Mild non-adherence risk noted for the evening dose.',
  ],
  [
    '1. Lanjutkan Aspirin 80 mg setiap pagi pukul 07:00 setelah sarapan.\n2. Lanjutkan Suplemen Kalsium 500 mg pukul 07:00 dan 19:00.\n3. Aktifkan pengingat otomatis WhatsApp & Push Notification untuk jadwal pukul 19:00.',
    '1. Continue Aspirin 80 mg every morning at 07:00 after breakfast.\n2. Continue Calcium Supplement 500 mg at 07:00 and 19:00.\n3. Enable automated WhatsApp & Push Notification reminders for the 19:00 schedule.',
  ],
  [
    'Minum tablet kalsium malam segera setelah makan malam dan gunakan fitur konfirmasi cepat pada pengingat WhatsApp/aplikasi.',
    'Take the evening calcium tablet right after dinner and use the quick confirmation button in the WhatsApp/app reminder.',
  ],

  // Seeded chat messages (including legacy updated messages)
  [
    'Selamat pagi, kemarin tekanan darah saya 142/91. Apakah perlu saya catat lagi sore ini?',
    'Good morning, my blood pressure yesterday was 142/91. Should I measure and log it again this evening?',
  ],
  [
    'Selamat pagi Ibu Aisyah. Ya, silakan catat hasil pengukuran saat sedang tenang dan sertakan keluhan bila ada. Bila tekanan darah 160/110 atau muncul sakit kepala berat atau pandangan kabur, segera hubungi fasilitas kesehatan.',
    'Good morning Ms. Aisyah. Yes, please log your reading while resting and note any symptoms. If blood pressure reaches 160/110 or you experience severe headache or blurred vision, contact a healthcare facility immediately.',
  ],
  ['Baik, terima kasih atas panduannya.', 'Understood, thank you for the guidance.'],
  [
    'Selamat pagi, apakah suplemen kalsium saya sebaiknya dicatat bersama obat lain?',
    'Good morning, should I log my calcium supplement together with my other medications?',
  ],
  [
    'Selamat pagi Ibu Aisyah. Silakan catat semua obat dan suplemen beserta waktunya. Tanyakan kembali jika ada perubahan resep. Bila tekanan darah 160/110 atau muncul keluhan berat, segera hubungi fasilitas kesehatan.',
    'Good morning Ms. Aisyah. Please log all medications and supplements with their scheduled times. Let me know if your prescription changes. If blood pressure reaches 160/110 or severe symptoms appear, contact a healthcare facility immediately.',
  ],
  [
    'Halo apoteker, saya ingin bertanya mengenai efek samping Amlodipine, apakah normal jika kaki sedikit bengkak?',
    'Hello pharmacist, I wanted to ask about Amlodipine side effects — is mild ankle or foot swelling normal?',
  ],
  [
    'Selamat siang, kemarin saya lupa minum dosis sore karena ketiduran. Hari ini sudah saya lanjutkan normal.',
    'Good afternoon, I missed yesterday’s evening dose because I fell asleep. Today I resumed my normal schedule.',
  ],
  [
    'Alhamdulillah obat minggu ini rutin diminum, tekanan darah juga stabil.',
    'Thankfully I took my medications consistently this week, and my blood pressure has stayed stable.',
  ],

  // Seeded WhatsApp logs & alarm confirmation note
  [
    '[Pengingat DoseLynx] Halo Aisyah Rahmadani, saatnya minum obat Anda: *Aspirin dosis rendah* (80 mg). Silakan konfirmasi di aplikasi setelah diminum.',
    '[DoseLynx Reminder] Hello Aisyah Rahmadani, it is time to take your medication: *Low-dose Aspirin* (80 mg). Please confirm in the app once taken.',
  ],
  [
    '[Tindak Lanjut DoseLynx] Halo Aisyah Rahmadani, Apoteker Rabiatul Adawiah, S.Farm., Apt. telah mencatat evaluasi terapi obat Anda. Rencana Terapi: Lanjutkan Aspirin 80 mg & Kalsium 500 mg sesuai jadwal.',
    '[DoseLynx Follow-Up] Hello Aisyah Rahmadani, Pharmacist Rabiatul Adawiah, S.Farm., Apt. has recorded your pharmacotherapy evaluation. Care Plan: Continue Aspirin 80 mg & Calcium 500 mg as scheduled.',
  ],
  ['Dikonfirmasi dari alarm pengingat DoseLynx', 'Confirmed from DoseLynx reminder alarm'],
];

const ID_TO_EN = new Map(SEED_TEXT_PAIRS);
const EN_TO_ID = new Map(SEED_TEXT_PAIRS.map(([id, en]) => [en, id]));

const MED_REPLACEMENTS_EN = [
  ['Aspirin dosis rendah', 'Low-dose Aspirin'],
  ['Suplemen kalsium', 'Calcium Supplement'],
  ['Metildopa', 'Methyldopa'],
];

const MED_REPLACEMENTS_ID = [
  ['Low-dose Aspirin', 'Aspirin dosis rendah'],
  ['Calcium Supplement', 'Suplemen kalsium'],
  ['Methyldopa', 'Metildopa'],
];

/**
 * Translates known seeded Indonesian/English strings to the active UI language.
 * Custom user-entered strings are returned unchanged.
 */
export function localizeSeedText(text, lang) {
  if (!text || typeof text !== 'string') return text;

  const trimmed = text.trim();
  const lookup = lang === 'en' ? ID_TO_EN : EN_TO_ID;

  // 1. Exact match
  if (lookup.has(trimmed)) {
    return lookup.get(trimmed);
  }

  // 2. Truncated prefix match (e.g., Recent Activity 80-char message snippets)
  if (trimmed.length >= 25) {
    for (const [key, val] of lookup.entries()) {
      if (key.length > trimmed.length && key.startsWith(trimmed)) {
        return val;
      }
    }
  }

  // 3. Embedded seeded medication name replacement (e.g. "Aspirin dosis rendah 80 mg")
  const replacements = lang === 'en' ? MED_REPLACEMENTS_EN : MED_REPLACEMENTS_ID;
  let result = text;
  for (const [from, to] of replacements) {
    if (result.includes(from)) {
      result = result.replaceAll(from, to);
    }
  }

  return result;
}

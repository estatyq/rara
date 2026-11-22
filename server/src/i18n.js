// Centralized bilingual dictionary (ID / EN) for all server-generated texts
// (Web Push notifications, WhatsApp messages, automated clinical chat notes).

const dict = {
  id: {
    brand: 'DoseLynx',
    doseTitle: 'Waktunya minum obat 💊',
    doseBody: (name, dosage) => `${name}${dosage ? ` – ${dosage}` : ''}. Ketuk untuk konfirmasi.`,
    actionTaken: 'Sudah diminum',
    actionOpen: 'Buka',
    newMessage: (from) => `Pesan baru dari ${from}`,
    testTitle: 'Notifikasi DoseLynx aktif ✅',
    testBody: 'Anda akan menerima pengingat minum obat & jadwal kontrol di perangkat ini.',
    bpCriticalTitle: 'Peringatan Tekanan Darah Kritis',
    bpCriticalBody: (who, sys, dia) => `${who}: ${sys}/${dia} mmHg. Segera tinjau hasil pengukuran.`,
    checkupTitle: 'Pengingat Jadwal Kontrol 🗓️',
    checkupBody: (title, when) => `${title} dijadwalkan pada ${when}.`,

    waDoseReminder: ({ name, medName, dosage, instructions }) =>
      `[Pengingat DoseLynx] Halo ${name}, saatnya minum obat Anda: *${medName}*${dosage ? ` (${dosage})` : ''}.${instructions ? ` Aturan pakai: ${instructions}` : ''} Silakan konfirmasi di aplikasi setelah diminum.`,

    waBpAlert: ({ name, systolic, diastolic, category }) =>
      `[Peringatan TD DoseLynx] Halo ${name}, hasil tekanan darah Anda *${systolic}/${diastolic} mmHg* termasuk kategori *${category === 'CRITICAL' ? 'KRITIS' : 'TINGGI'}*. ${category === 'CRITICAL' ? 'Segera hubungi fasilitas kesehatan atau apoteker Anda bila disertai keluhan.' : 'Silakan istirahat tenang, ukur ulang 15 menit lagi, dan konsultasikan dengan apoteker Anda.'}`,

    waFollowUp: ({ patientName, pharmacistName, plan, recommendation }) =>
      `[Tindak Lanjut DoseLynx] Halo ${patientName}, Apoteker ${pharmacistName} telah mencatat evaluasi terapi obat Anda.\nRencana Terapi: ${plan}${recommendation ? `\nRekomendasi: ${recommendation}` : ''}`,

    waServiceUpdate: ({ patientName, serviceName, status, pharmacistName, reply }) =>
      `[Layanan Farmasi DoseLynx] Halo ${patientName}, permintaan layanan *${serviceName}* Anda kini berstatus *${status}*.${reply ? ` Catatan Apoteker (${pharmacistName}): ${reply}` : ''}`,

    waCheckupReminder: ({ name, title, when, location }) =>
      `[Pengingat Kontrol DoseLynx] Halo ${name}, jangan lupa jadwal *${title}* pada ${when}${location ? ` di ${location}` : ''}. Catat tekanan darah & keluhan Anda sebelum sesi kontrol.`,

    chatFollowUpSummary: ({ plan, recommendation }) =>
      `[Tindak Lanjut Farmakoterapi / PTO]\n• Rencana (Plan): ${plan}${recommendation ? `\n• Rekomendasi Apoteker: ${recommendation}` : ''}`,

    chatServiceRequest: ({ serviceName, complaint }) =>
      `[Permintaan Layanan: ${serviceName}] ${complaint ? `Keluhan/Catatan: ${complaint}` : 'Mengajukan permintaan layanan kefarmasian.'}`,

    chatServiceReply: ({ serviceName, status, reply }) =>
      `[${serviceName} — ${status}] ${reply}`,
  },

  en: {
    brand: 'DoseLynx',
    doseTitle: 'Time to take your medicine 💊',
    doseBody: (name, dosage) => `${name}${dosage ? ` – ${dosage}` : ''}. Tap to confirm.`,
    actionTaken: 'Taken',
    actionOpen: 'Open',
    newMessage: (from) => `New message from ${from}`,
    testTitle: 'DoseLynx notifications enabled ✅',
    testBody: 'You will receive medication and check-up reminders on this device.',
    bpCriticalTitle: 'Critical Blood Pressure Alert',
    bpCriticalBody: (who, sys, dia) => `${who}: ${sys}/${dia} mmHg. Immediate clinical review needed.`,
    checkupTitle: 'Upcoming Check-Up Reminder 🗓️',
    checkupBody: (title, when) => `${title} is scheduled for ${when}.`,

    waDoseReminder: ({ name, medName, dosage, instructions }) =>
      `[DoseLynx Reminder] Hello ${name}, it is time to take your medication: *${medName}*${dosage ? ` (${dosage})` : ''}.${instructions ? ` Instructions: ${instructions}` : ''} Please confirm in the app once taken.`,

    waBpAlert: ({ name, systolic, diastolic, category }) =>
      `[DoseLynx BP Alert] Hello ${name}, your blood pressure reading of *${systolic}/${diastolic} mmHg* is classified as *${category}*. ${category === 'CRITICAL' ? 'Please seek immediate medical evaluation or contact your clinical pharmacist.' : 'Please rest quietly, re-measure in 15 minutes, and consult your pharmacist.'}`,

    waFollowUp: ({ patientName, pharmacistName, plan, recommendation }) =>
      `[DoseLynx Pharmacist Follow-Up] Hello ${patientName}, ${pharmacistName} has recorded a pharmacotherapy follow-up.\nPlan: ${plan}${recommendation ? `\nRecommendation: ${recommendation}` : ''}`,

    waServiceUpdate: ({ patientName, serviceName, status, pharmacistName, reply }) =>
      `[DoseLynx Pharmacy Service] Hello ${patientName}, your request for *${serviceName}* is now *${status}*.${reply ? ` Pharmacist (${pharmacistName}) note: ${reply}` : ''}`,

    waCheckupReminder: ({ name, title, when, location }) =>
      `[DoseLynx Check-Up Reminder] Hello ${name}, reminder for your upcoming *${title}* on ${when}${location ? ` at ${location}` : ''}. Please log your latest blood pressure before the visit.`,

    chatFollowUpSummary: ({ plan, recommendation }) =>
      `[Pharmacotherapy Follow-Up / PTO]\n• Plan: ${plan}${recommendation ? `\n• Pharmacist Recommendation: ${recommendation}` : ''}`,

    chatServiceRequest: ({ serviceName, complaint }) =>
      `[Service Request: ${serviceName}] ${complaint ? `Complaint/Notes: ${complaint}` : 'Requested pharmaceutical care service.'}`,

    chatServiceReply: ({ serviceName, status, reply }) =>
      `[${serviceName} — ${status}] ${reply}`,
  },
};

export const tr = (locale) => dict[locale === 'en' ? 'en' : 'id'];

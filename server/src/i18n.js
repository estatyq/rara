// Small dictionary for texts generated on the server (push notifications).
const dict = {
  id: {
    doseTitle: 'Waktunya minum obat 💊',
    doseBody: (name, dosage) => `${name}${dosage ? ` – ${dosage}` : ''}. Ketuk untuk konfirmasi.`,
    actionTaken: 'Sudah diminum',
    actionOpen: 'Buka',
    newMessage: (from) => `Pesan baru dari ${from}`,
    testTitle: 'Notifikasi aktif ✅',
    testBody: 'Anda akan menerima pengingat minum obat di perangkat ini.',
  },
  en: {
    doseTitle: 'Time to take your medicine 💊',
    doseBody: (name, dosage) => `${name}${dosage ? ` – ${dosage}` : ''}. Tap to confirm.`,
    actionTaken: 'Taken',
    actionOpen: 'Open',
    newMessage: (from) => `New message from ${from}`,
    testTitle: 'Notifications enabled ✅',
    testBody: 'You will receive medication reminders on this device.',
  },
};

export const tr = (locale) => dict[locale] || dict.id;

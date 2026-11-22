/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { articles } from './seed-articles.js';
import { questionnaires } from './seed-questionnaires.js';

const prisma = new PrismaClient();
const TZ = 'Asia/Jakarta';

async function upsertUser({ email, password, ...data }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const orConditions = [{ email }];
  if (data.phone) orConditions.push({ phone: data.phone });
  const existing = await prisma.user.findFirst({ where: { OR: orConditions } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { email, passwordHash, ...data },
    });
  }
  return prisma.user.create({
    data: { email, passwordHash, ...data },
  });
}

async function main() {
  const admin = await upsertUser({ email: 'admin@doselynx.com', password: 'admin123', name: 'Admin Sistem Farmasi', phone: '+628110000100', role: 'ADMIN' });
  const pharmacist = await upsertUser({
    email: 'apoteker@doselynx.com',
    password: 'apoteker123',
    phone: '+6281299887766',
    name: 'Rabiatul Adawiah, S.Farm., Apt.',
    role: 'PHARMACIST',
  });
  const secondPharmacist = await upsertUser({
    email: 'apoteker2@doselynx.com',
    password: 'apoteker123',
    phone: '+6281355667788',
    name: 'apt. Hendra Wijaya, S.Farm.',
    role: 'PHARMACIST',
  });

  await prisma.pharmacistProfile.upsert({
    where: { userId: pharmacist.id },
    update: {
      straNumber: '19960512/STRA-UNHAS/2021/28491',
      sipaNumber: '503/SIPA.042/DINKES-MKS/2023',
      workplace: 'Instalasi Farmasi Klinis RSIA & Puskesmas Mitra',
      specialization: 'Farmasi Klinis, Kehamilan Risiko Tinggi & Preeklampsia',
      yearsExperience: 6,
      bioId: 'Apoteker klinis penanggung jawab pemantauan farmakoterapi ibu hamil, hipertensi kehamilan, dan edukasi kepatuhan terapi.',
      bioEn: 'Lead clinical pharmacist specializing in maternal pharmacotherapy monitoring, gestational hypertension, and adherence counseling.',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: admin.id,
      verificationNote: 'Kredensial STRA dan SIPA terverifikasi resmi oleh Administrator.',
    },
    create: {
      userId: pharmacist.id,
      straNumber: '19960512/STRA-UNHAS/2021/28491',
      sipaNumber: '503/SIPA.042/DINKES-MKS/2023',
      workplace: 'Instalasi Farmasi Klinis RSIA & Puskesmas Mitra',
      specialization: 'Farmasi Klinis, Kehamilan Risiko Tinggi & Preeklampsia',
      yearsExperience: 6,
      bioId: 'Apoteker klinis penanggung jawab pemantauan farmakoterapi ibu hamil, hipertensi kehamilan, dan edukasi kepatuhan terapi.',
      bioEn: 'Lead clinical pharmacist specializing in maternal pharmacotherapy monitoring, gestational hypertension, and adherence counseling.',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      verifiedById: admin.id,
      verificationNote: 'Kredensial STRA dan SIPA terverifikasi resmi oleh Administrator.',
    },
  });

  await prisma.pharmacistProfile.upsert({
    where: { userId: secondPharmacist.id },
    update: {},
    create: {
      userId: secondPharmacist.id,
      straNumber: '19981104/STRA-UI/2024/11902',
      sipaNumber: '503/SIPA.118/DINKES/2025',
      workplace: 'Klinik Pratama & Apotek Sehat Bersama',
      specialization: 'Pelayanan Informasi Obat & Konseling Terapi Kronis',
      yearsExperience: 3,
      bioId: 'Apoteker layanan telefarmasi dan konseling jadwal pengobatan pasien.',
      bioEn: 'Telepharmacy and medication schedule counseling pharmacist.',
      verificationStatus: 'PENDING',
    },
  });

  for (const a of articles) {
    await prisma.article.upsert({ where: { slug: a.slug }, update: a, create: a });
  }
  for (const q of questionnaires) {
    const existing = await prisma.questionnaire.findUnique({ where: { code: q.code }, include: { _count: { select: { responses: true } } } });
    if (!existing) await prisma.questionnaire.create({ data: q });
    else if (!existing._count.responses) await prisma.questionnaire.update({ where: { code: q.code }, data: q });
  }

  // Demo patient with two weeks of history
  const patientUser = await upsertUser({
    email: 'pasien@doselynx.com',
    password: 'pasien123',
    phone: '+6281234567890',
    name: 'Aisyah Rahmadani',
    role: 'PATIENT',
    timezone: TZ,
  });
  const estimatedDueDate = DateTime.now().setZone(TZ).startOf('day').plus({ weeks: 8, days: 3 });
  const patientData = {
    pharmacistId: pharmacist.id,
    studyCode: 'P-001',
    dateOfBirth: DateTime.fromISO('1994-02-18', { zone: TZ }).toJSDate(),
    gender: 'FEMALE',
    address: 'Jl. Perintis Kemerdekaan, Makassar',
    diagnosis: 'Kehamilan risiko tinggi, hipertensi kronis ringan',
    allergies: 'Tidak ada alergi obat yang diketahui',
    estimatedDueDate: estimatedDueDate.toJSDate(),
    studyGroup: 'INTERVENTION',
    riskFactors: 'Hipertensi kronis; riwayat preeklampsia pada kehamilan sebelumnya',
    baselineSystolic: 136,
    baselineDiastolic: 86,
    consentedAt: DateTime.now().setZone(TZ).minus({ days: 14 }).toJSDate(),
    notes: 'Peserta penelitian pemantauan apoteker melalui aplikasi. Perlu evaluasi kepatuhan dan tekanan darah setiap minggu.',
  };
  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: patientData,
    create: { userId: patientUser.id, ...patientData },
  });

  const hasMeds = await prisma.medication.count({ where: { patientId: patient.id } });
  if (!hasMeds) {
    const start = DateTime.now().setZone(TZ).startOf('day').minus({ days: 14 });
    const aspirinArticle = await prisma.article.findUnique({ where: { slug: 'aspirin-dosis-rendah' } });
    const calciumArticle = await prisma.article.findUnique({ where: { slug: 'kalsium-kehamilan' } });
    const meds = await Promise.all([
      prisma.medication.create({
        data: {
          patientId: patient.id, name: 'Aspirin dosis rendah', dosage: '80 mg', form: 'Tablet', instructions: 'Ikuti dosis dan waktu yang diresepkan. Jangan mengubah dosis sendiri.',
          times: ['07:00'], startDate: start.toJSDate(), createdAt: start.toJSDate(), articleId: aspirinArticle?.id, createdById: pharmacist.id,
        },
      }),
      prisma.medication.create({
        data: {
          patientId: patient.id, name: 'Suplemen kalsium', dosage: '500 mg', form: 'Tablet', instructions: 'Ikuti rekomendasi petugas kesehatan dan catat keluhan yang muncul.',
          times: ['07:00', '19:00'], startDate: start.toJSDate(), createdAt: start.toJSDate(), articleId: calciumArticle?.id, createdById: pharmacist.id,
        },
      }),
    ]);

    // Deterministic pseudo-random history (~85% adherence)
    let seed = 42;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const rows = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const day = start.plus({ days: i });
      for (const med of meds) {
        for (const t of med.times) {
          const [h, m] = t.split(':').map(Number);
          const at = day.set({ hour: h, minute: m });
          if (at.toJSDate() > now) continue;
          const r = rnd();
          const status = r < 0.85 ? 'TAKEN' : r < 0.9 ? 'SKIPPED' : 'MISSED';
          rows.push({
            medicationId: med.id, patientId: patient.id, scheduledAt: at.toJSDate(), status, remindedAt: at.toJSDate(),
            takenAt: status === 'TAKEN' ? at.plus({ minutes: Math.round(rnd() * 50) }).toJSDate() : null,
          });
        }
      }
    }
    await prisma.doseLog.createMany({ data: rows, skipDuplicates: true });

    await prisma.message.createMany({
      data: [
        { patientId: patient.id, senderId: patientUser.id, body: 'Selamat pagi, kemarin tekanan darah saya 142/91. Apakah perlu saya catat lagi sore ini?', createdAt: start.plus({ days: 3, hours: 8 }).toJSDate(), readAt: start.plus({ days: 3, hours: 9 }).toJSDate() },
        { patientId: patient.id, senderId: pharmacist.id, body: 'Selamat pagi Ibu Aisyah. Ya, silakan catat hasil pengukuran saat sedang tenang dan sertakan keluhan bila ada. Bila tekanan darah 160/110 atau muncul sakit kepala berat atau pandangan kabur, segera hubungi fasilitas kesehatan.', createdAt: start.plus({ days: 3, hours: 9 }).toJSDate(), readAt: start.plus({ days: 3, hours: 10 }).toJSDate() },
        { patientId: patient.id, senderId: patientUser.id, body: 'Baik, terima kasih atas panduannya.', createdAt: start.plus({ days: 3, hours: 10 }).toJSDate() },
      ],
    });
  }

  // Keep an existing demo database aligned with the pregnancy study without
  // deleting dose history or other records created during manual testing.
  const aspirinArticle = await prisma.article.findUnique({ where: { slug: 'aspirin-dosis-rendah' } });
  const calciumArticle = await prisma.article.findUnique({ where: { slug: 'kalsium-kehamilan' } });
  const legacyAspirin = await prisma.medication.findFirst({
    where: { patientId: patient.id, name: 'Amlodipin' },
  });
  if (legacyAspirin) {
    await prisma.medication.update({
      where: { id: legacyAspirin.id },
      data: {
        name: 'Aspirin dosis rendah',
        dosage: '80 mg',
        form: 'Tablet',
        instructions: 'Ikuti dosis dan waktu yang diresepkan. Jangan mengubah dosis sendiri.',
        articleId: aspirinArticle?.id,
      },
    });
  }
  const legacyCalcium = await prisma.medication.findFirst({
    where: { patientId: patient.id, name: 'Metformin' },
  });
  if (legacyCalcium) {
    await prisma.medication.update({
      where: { id: legacyCalcium.id },
      data: {
        name: 'Suplemen kalsium',
        dosage: '500 mg',
        form: 'Tablet',
        instructions: 'Ikuti rekomendasi petugas kesehatan dan catat keluhan yang muncul.',
        articleId: calciumArticle?.id,
      },
    });
  }
  await prisma.message.updateMany({
    where: { patientId: patient.id, body: { contains: 'metformin', mode: 'insensitive' } },
    data: { body: 'Selamat pagi, apakah suplemen kalsium saya sebaiknya dicatat bersama obat lain?' },
  });
  await prisma.message.updateMany({
    where: { patientId: patient.id, body: { contains: 'lambung', mode: 'insensitive' } },
    data: {
      body: 'Selamat pagi Ibu Aisyah. Silakan catat semua obat dan suplemen beserta waktunya. Tanyakan kembali jika ada perubahan resep. Bila tekanan darah 160/110 atau muncul keluhan berat, segera hubungi fasilitas kesehatan.',
    },
  });

  const bpCount = await prisma.bloodPressureLog.count({ where: { patientId: patient.id } });
  if (!bpCount) {
    const values = [
      [142, 91, 88], [138, 88, 84], [136, 87, 82], [132, 84, 80], [128, 81, 79],
      [130, 82, 81], [126, 79, 78], [124, 78, 76], [128, 80, 79], [122, 77, 75],
    ];
    await prisma.bloodPressureLog.createMany({
      data: values.map(([systolic, diastolic, pulse], index) => {
        const daysAgo = values.length - index - 1;
        return {
          patientId: patient.id,
          systolic,
          diastolic,
          pulse,
          measuredAt: DateTime.now().setZone(TZ).startOf('day').minus({ days: daysAgo }).set({ hour: 8, minute: 15 }).toJSDate(),
          note: index === 0 ? 'Duduk tenang, diukur sebelum sarapan.' : null,
          source: index % 4 === 0 ? 'CLINIC' : 'SELF',
        };
      }),
    });
  }

  const todayStart = DateTime.now().setZone(TZ).startOf('day');
  const todayDoses = await prisma.doseLog.findMany({
    where: {
      patientId: patient.id,
      scheduledAt: {
        gte: todayStart.toJSDate(),
        lt: todayStart.plus({ days: 1 }).toJSDate(),
      },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  if (todayDoses.length >= 2) {
    await prisma.doseLog.update({
      where: { id: todayDoses[0].id },
      data: {
        status: 'TAKEN',
        takenAt: new Date(+todayDoses[0].scheduledAt + 12 * 60000),
      },
    });
    await prisma.doseLog.update({
      where: { id: todayDoses[1].id },
      data: { status: 'SKIPPED', takenAt: null },
    });
  }

  // Seed Pharmacy Services Catalog
  const servicesCatalog = [
    {
      code: 'SVC-PTO',
      category: 'PTO',
      nameId: 'Pemantauan Terapi Obat (PTO) Ibu Hamil & Preeklampsia',
      nameEn: 'Maternal & Preeclampsia Pharmacotherapy Monitoring (PTO)',
      descriptionId: 'Evaluasi menyeluruh efektivitas terapi, kepatuhan minum obat (aspirin dosis rendah, kalsium, antihipertensi), dan pemantauan tren tekanan darah oleh apoteker klinis.',
      descriptionEn: 'Comprehensive evaluation of therapy effectiveness, medication adherence (low-dose aspirin, calcium, antihypertensives), and blood pressure trend monitoring by a clinical pharmacist.',
      durationMinutes: 30,
      priceIDR: 0,
      icon: 'HeartPulse',
      active: true,
    },
    {
      code: 'SVC-TELE',
      category: 'TELEPHARMACY',
      nameId: 'Konsultasi Telefarmasi & Informasi Obat (PIO)',
      nameEn: 'Telepharmacy Consultation & Drug Information Service',
      descriptionId: 'Konsultasi langsung via chat atau WhatsApp bersama apoteker terverifikasi mengenai dosis, aturan pakai, interaksi obat, dan keamanan obat selama kehamilan.',
      descriptionEn: 'Direct consultation via chat or WhatsApp with a verified pharmacist regarding dosage, administration rules, drug interactions, and pregnancy medication safety.',
      durationMinutes: 20,
      priceIDR: 0,
      icon: 'MessageSquare',
      active: true,
    },
    {
      code: 'SVC-RECON',
      category: 'RECONCILIATION',
      nameId: 'Rekonsiliasi & Penyusunan Jadwal Pengobatan',
      nameEn: 'Medication Reconciliation & Schedule Optimization',
      descriptionId: 'Penyelarasan daftar obat resep dokter, suplemen kehamilan, dan pengaturan jam alarm pengingat agar tidak terjadi duplikasi atau interaksi antar obat (misal jeda kalsium & zat besi).',
      descriptionEn: 'Alignment of prescribed medications, prenatal supplements, and alarm schedules to prevent duplication or absorption interactions (e.g., spacing calcium and iron).',
      durationMinutes: 25,
      priceIDR: 0,
      icon: 'Calendar',
      active: true,
    },
    {
      code: 'SVC-COUNSEL',
      category: 'COUNSELING',
      nameId: 'Konseling Kepatuhan & Penanganan Efek Samping (MESO)',
      nameEn: 'Adherence Counseling & Adverse Drug Reaction Monitoring',
      descriptionId: 'Pendampingan khusus bagi pasien yang mengalami kendala lupa minum obat, mual, atau keluhan efek samping terapi untuk dicarikan solusi klinis.',
      descriptionEn: 'Dedicated guidance for patients experiencing missed doses, nausea, or side effects to identify safe clinical solutions.',
      durationMinutes: 30,
      priceIDR: 0,
      icon: 'ShieldCheck',
      active: true,
    },
    {
      code: 'SVC-HOME',
      category: 'HOME_CARE',
      nameId: 'Pendampingan Farmasi Keluarga (Home Pharmacy Care)',
      nameEn: 'Home Pharmacy Care & Blood Pressure Review',
      descriptionId: 'Layanan tindak lanjut berkala untuk memantau penyimpanan obat di rumah, teknik pengukuran tekanan darah mandiri yang tepat, dan dukungan keluarga.',
      descriptionEn: 'Periodic follow-up service to review home medication storage, proper self-blood-pressure measurement technique, and family support.',
      durationMinutes: 45,
      priceIDR: 0,
      icon: 'Stethoscope',
      active: true,
    },
  ];

  const createdServices = [];
  for (const s of servicesCatalog) {
    const svc = await prisma.pharmacyService.upsert({
      where: { code: s.code },
      update: s,
      create: s,
    });
    createdServices.push(svc);
  }

  // Seed a sample ServiceRequest
  const existingReqCount = await prisma.serviceRequest.count({ where: { patientId: patient.id } });
  if (!existingReqCount && createdServices.length > 0) {
    await prisma.serviceRequest.create({
      data: {
        patientId: patient.id,
        serviceId: createdServices[0].id,
        pharmacistId: pharmacist.id,
        preferredDate: DateTime.now().setZone(TZ).plus({ days: 2 }).set({ hour: 10, minute: 0 }).toJSDate(),
        complaint: 'Ingin evaluasi jadwal minum kalsium dan aspirin serta tinjauan hasil tekanan darah minggu ini.',
        status: 'CONFIRMED',
        pharmacistReply: 'Jadwal evaluasi PTO telah dikonfirmasi. Pastikan mencatat tekanan darah pagi sebelum sesi konsultasi.',
      },
    });
  }

  // Seed a sample Pharmacotherapy Follow-Up / PTO Report
  const existingFollowUpCount = await prisma.patientFollowUp.count({ where: { patientId: patient.id } });
  if (!existingFollowUpCount) {
    await prisma.patientFollowUp.create({
      data: {
        patientId: patient.id,
        pharmacistId: pharmacist.id,
        type: 'PTO_REPORT',
        subjective: 'Pasien melaporkan tidak ada sakit kepala hebat atau gangguan penglihatan. Kadang lupa dosis kalsium malam hari bila kelelahan.',
        objective: 'TD rata-rata 7 hari terakhir: 126/79 mmHg (Terkontrol <140/90 mmHg). Kepatuhan minum obat 30 hari ~85%.',
        assessment: 'Terapi profilaksis preeklampsia (Aspirin 80 mg 1x1 & Kalsium 500 mg 2x1) efektif dan ditoleransi baik. Ditemukan risiko ketidakpatuhan ringan pada dosis malam.',
        plan: '1. Lanjutkan Aspirin 80 mg setiap pagi pukul 07:00 setelah sarapan.\n2. Lanjutkan Suplemen Kalsium 500 mg pukul 07:00 dan 19:00.\n3. Aktifkan pengingat otomatis WhatsApp & Push Notification untuk jadwal pukul 19:00.',
        drpCategory: 'NON_ADHERENCE',
        recommendation: 'Minum tablet kalsium malam segera setelah makan malam dan gunakan fitur konfirmasi cepat pada pengingat WhatsApp/aplikasi.',
        adherenceRate: 85.0,
        latestBp: '122/77 mmHg',
        nextFollowUpDate: DateTime.now().setZone(TZ).plus({ days: 7 }).toJSDate(),
        sentViaWhatsApp: true,
      },
    });
  }

  // Seed sample Health Parameters & Checkup Reminders for demo patient P-001
  const existingParams = await prisma.healthParameterLog.count({ where: { patientId: patient.id } });
  if (!existingParams) {
    const weights = [63.2, 63.6, 64.1, 64.4, 64.8];
    await prisma.healthParameterLog.createMany({
      data: [
        ...weights.map((val, idx) => ({
          patientId: patient.id,
          type: 'WEIGHT',
          value: val,
          unit: 'kg',
          context: 'MORNING',
          note: idx === weights.length - 1 ? 'Kenaikan berat badan stabil sesuai usia kehamilan.' : null,
          source: 'SELF',
          measuredAt: DateTime.now().setZone(TZ).startOf('day').minus({ days: (weights.length - 1 - idx) * 3 }).set({ hour: 7, minute: 30 }).toJSDate(),
        })),
        {
          patientId: patient.id,
          type: 'HEART_RATE',
          value: 78,
          unit: 'bpm',
          context: 'RESTING',
          source: 'SELF',
          measuredAt: DateTime.now().setZone(TZ).minus({ days: 1 }).set({ hour: 8, minute: 20 }).toJSDate(),
        },
        {
          patientId: patient.id,
          type: 'SPO2',
          value: 98,
          unit: '%',
          context: 'RESTING',
          source: 'SELF',
          measuredAt: DateTime.now().setZone(TZ).minus({ days: 1 }).set({ hour: 8, minute: 25 }).toJSDate(),
        },
        {
          patientId: patient.id,
          type: 'FETAL_MOVEMENT',
          value: 12,
          unit: 'kicks/2h',
          context: 'EVENING',
          note: 'Gerakan janin aktif setelah makan malam.',
          source: 'SELF',
          measuredAt: DateTime.now().setZone(TZ).minus({ hours: 10 }).toJSDate(),
        },
      ],
    });
  }

  const existingCheckups = await prisma.checkupReminder.count({ where: { patientId: patient.id } });
  if (!existingCheckups) {
    await prisma.checkupReminder.createMany({
      data: [
        {
          patientId: patient.id,
          createdById: pharmacist.id,
          title: 'Kontrol Antenatal (ANC) & Evaluasi Tekanan Darah',
          type: 'CHECKUP',
          scheduledAt: DateTime.now().setZone(TZ).plus({ days: 3 }).set({ hour: 9, minute: 30 }).toJSDate(),
          location: 'Poli Obgyn RSIA Mitra',
          notes: 'Bawa catatan tekanan darah 2 minggu terakhir dari aplikasi DoseLynx.',
          status: 'UPCOMING',
        },
        {
          patientId: patient.id,
          createdById: pharmacist.id,
          title: 'Tindak Lanjut Pemantauan Terapi Obat (PTO)',
          type: 'FOLLOW_UP',
          scheduledAt: DateTime.now().setZone(TZ).plus({ days: 7 }).set({ hour: 10, minute: 0 }).toJSDate(),
          location: 'Telefarmasi DoseLynx',
          notes: 'Evaluasi kepatuhan aspirin dosis rendah dan suplemen kalsium.',
          status: 'UPCOMING',
        },
        {
          patientId: patient.id,
          createdById: pharmacist.id,
          title: 'Pengambilan Ulang Obat (Refill Resep)',
          type: 'REFILL',
          scheduledAt: DateTime.now().setZone(TZ).plus({ days: 11 }).set({ hour: 14, minute: 0 }).toJSDate(),
          location: 'Instalasi Farmasi Klinis',
          notes: 'Siapkan sisa blister obat untuk rekonsiliasi.',
          status: 'UPCOMING',
        },
      ],
    });
  }

  // Seed additional realistic cohort patients so Pharmacist Dashboard KPIs, At-Risk, Trends & Activity are rich
  const extraCohort = [
    {
      email: 'siti@doselynx.com',
      phone: '+6281211112222',
      name: 'Siti Rahmawati',
      studyCode: 'P-002',
      diagnosis: 'Hipertensi gestasional, pemantauan risiko preeklampsia',
      medName: 'Amlodipine',
      dosage: '5 mg',
      times: ['08:00', '20:00'],
      adherenceTarget: 0.62,
      bpSeries: [[154, 98, 88], [150, 95, 86], [148, 94, 85], [152, 96, 87], [150, 95, 84]],
      msg: 'Halo apoteker, saya ingin bertanya mengenai efek samping Amlodipine, apakah normal jika kaki sedikit bengkak?',
    },
    {
      email: 'dewi@doselynx.com',
      phone: '+6281233334444',
      name: 'Dewi Lestari',
      studyCode: 'P-003',
      diagnosis: 'Hipertensi kronis pada kehamilan trimester II',
      medName: 'Metildopa',
      dosage: '250 mg',
      times: ['07:00', '19:00'],
      adherenceTarget: 0.72,
      bpSeries: [[144, 92, 82], [142, 90, 81], [138, 88, 80], [141, 90, 82], [140, 90, 80]],
      msg: 'Selamat siang, kemarin saya lupa minum dosis sore karena ketiduran. Hari ini sudah saya lanjutkan normal.',
    },
    {
      email: 'nur@doselynx.com',
      phone: '+6281255556666',
      name: 'Nur Aisyah',
      studyCode: 'P-004',
      diagnosis: 'Kehamilan risiko preeklampsia ringan — terapi profilaksis',
      medName: 'Aspirin dosis rendah',
      dosage: '80 mg',
      times: ['07:00'],
      adherenceTarget: 0.92,
      bpSeries: [[132, 84, 78], [130, 82, 76], [128, 80, 77], [134, 84, 79], [128, 82, 76]],
      msg: 'Alhamdulillah obat minggu ini rutin diminum, tekanan darah juga stabil.',
    },
  ];

  for (const c of extraCohort) {
    const u = await upsertUser({
      email: c.email,
      password: 'pasien123',
      phone: c.phone,
      name: c.name,
      role: 'PATIENT',
      timezone: TZ,
    });
    const p = await prisma.patient.upsert({
      where: { userId: u.id },
      update: {
        pharmacistId: pharmacist.id,
        studyCode: c.studyCode,
        diagnosis: c.diagnosis,
      },
      create: {
        userId: u.id,
        pharmacistId: pharmacist.id,
        studyCode: c.studyCode,
        gender: 'FEMALE',
        diagnosis: c.diagnosis,
        estimatedDueDate: DateTime.now().setZone(TZ).plus({ weeks: 10 }).toJSDate(),
        studyGroup: 'INTERVENTION',
        consentedAt: DateTime.now().setZone(TZ).minus({ days: 12 }).toJSDate(),
      },
    });
    const cnt = await prisma.medication.count({ where: { patientId: p.id } });
    if (!cnt) {
      const start = DateTime.now().setZone(TZ).startOf('day').minus({ days: 10 });
      const med = await prisma.medication.create({
        data: {
          patientId: p.id,
          name: c.medName,
          dosage: c.dosage,
          form: 'Tablet',
          instructions: 'Minum rutin sesuai jadwal alarm DoseLynx.',
          times: c.times,
          startDate: start.toJSDate(),
          createdAt: start.toJSDate(),
          createdById: pharmacist.id,
        },
      });
      const doseRows = [];
      const now = new Date();
      let idx = 0;
      for (let d = 0; d < 10; d++) {
        const day = start.plus({ days: d });
        for (const tStr of c.times) {
          const [hh, mm] = tStr.split(':').map(Number);
          const at = day.set({ hour: hh, minute: mm });
          if (at.toJSDate() > now) continue;
          idx++;
          const ratio = (idx * 37 % 100) / 100;
          const status = ratio < c.adherenceTarget ? 'TAKEN' : ratio < c.adherenceTarget + 0.12 ? 'SKIPPED' : 'MISSED';
          doseRows.push({
            medicationId: med.id,
            patientId: p.id,
            scheduledAt: at.toJSDate(),
            status,
            remindedAt: at.toJSDate(),
            takenAt: status === 'TAKEN' ? at.plus({ minutes: 10 }).toJSDate() : null,
          });
        }
      }
      await prisma.doseLog.createMany({ data: doseRows, skipDuplicates: true });

      await prisma.bloodPressureLog.createMany({
        data: c.bpSeries.map(([sys, dia, pulse], i) => ({
          patientId: p.id,
          systolic: sys,
          diastolic: dia,
          pulse,
          measuredAt: DateTime.now().setZone(TZ).startOf('day').minus({ days: c.bpSeries.length - 1 - i }).set({ hour: 8, minute: 30 }).toJSDate(),
          source: 'SELF',
        })),
      });

      await prisma.message.create({
        data: {
          patientId: p.id,
          senderId: u.id,
          body: c.msg,
          createdAt: DateTime.now().setZone(TZ).minus({ hours: 4 }).toJSDate(),
        },
      });
    }
  }

  // Seed sample WhatsApp Logs
  const waCount = await prisma.whatsAppLog.count();
  if (!waCount) {
    await prisma.whatsAppLog.createMany({
      data: [
        {
          userId: patientUser.id,
          patientId: patient.id,
          phone: '+6281234567890',
          direction: 'OUTBOUND',
          category: 'DOSE_REMINDER',
          message: '[Pengingat DoseLynx] Halo Aisyah Rahmadani, saatnya minum obat Anda: *Aspirin dosis rendah* (80 mg). Silakan konfirmasi di aplikasi setelah diminum.',
          status: 'DELIVERED',
          provider: 'SIMULATOR',
          externalId: 'wa-seed-101',
        },
        {
          userId: patientUser.id,
          patientId: patient.id,
          phone: '+6281234567890',
          direction: 'OUTBOUND',
          category: 'FOLLOW_UP',
          message: '[Tindak Lanjut DoseLynx] Halo Aisyah Rahmadani, Apoteker Rabiatul Adawiah, S.Farm., Apt. telah mencatat evaluasi terapi obat Anda. Rencana Terapi: Lanjutkan Aspirin 80 mg & Kalsium 500 mg sesuai jadwal.',
          status: 'DELIVERED',
          provider: 'SIMULATOR',
          externalId: 'wa-seed-102',
        },
      ],
    });
  }

  // Seed System Config
  const defaultConfigs = [
    ['whatsapp_enabled', 'true'],
    ['whatsapp_provider', 'SIMULATOR'],
    ['whatsapp_api_url', 'https://api.fonnte.com/send'],
    ['whatsapp_sender_number', '+6281299887766'],
    ['whatsapp_auto_dose_reminder', 'true'],
    ['whatsapp_auto_bp_alert', 'true'],
    ['platform_owner', 'Rabiatul Adawiah, S.Farm., Apt.'],
  ];
  for (const [key, value] of defaultConfigs) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log('Seed complete.');
  console.log('  Admin:      admin@doselynx.com / admin123');
  console.log('  Pharmacist: apoteker@doselynx.com / apoteker123');
  console.log('  Patient:    pasien@doselynx.com (or 081234567890) / pasien123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

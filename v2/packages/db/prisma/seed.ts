import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();
const TZ_ID = 'Asia/Jakarta';
const TZ_SG = 'Asia/Singapore';

async function upsertUser(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  globalRole: 'PATIENT' | 'CAREGIVER' | 'PHARMACIST' | 'TENANT_ADMIN' | 'SUPER_ADMIN';
  locale?: string;
  timezone?: string;
  countryCode?: string;
  privacyMode?: boolean;
}) {
  const passwordHash = await hash(input.password);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone ?? null,
      globalRole: input.globalRole,
      passwordHash,
      locale: input.locale ?? 'id',
      timezone: input.timezone ?? TZ_ID,
      countryCode: input.countryCode ?? 'ID',
      privacyMode: input.privacyMode ?? true,
      active: true,
    },
    create: {
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      globalRole: input.globalRole,
      passwordHash,
      locale: input.locale ?? 'id',
      timezone: input.timezone ?? TZ_ID,
      countryCode: input.countryCode ?? 'ID',
      privacyMode: input.privacyMode ?? true,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: input.phone ? new Date() : null,
      active: true,
    },
  });
}

async function main() {
  // 1. Two independent Pharmacy Tenants (Indonesia + Singapore) to prove Global Multi-Tenancy
  const tenantId = await prisma.tenant.upsert({
    where: { slug: 'mitra-makassar' },
    update: {},
    create: {
      slug: 'mitra-makassar',
      name: 'Apotek & Farmasi Klinis Mitra',
      countryCode: 'ID',
      defaultCurrency: 'IDR',
      defaultLocale: 'id',
      inviteCode: 'DOSE-MKS-01',
      brandPrimaryHex: '#0D9488',
      quota: {
        create: {
          planCode: 'CLINIC_PRO',
          maxPatients: 1000,
          maxPharmacists: 20,
          monthlyWaLimit: 5000,
        },
      },
      integrationConfig: {
        create: {
          whatsappEnabled: true,
          whatsappProvider: 'SIMULATOR',
          whatsappSenderId: '+6281299887766',
        },
      },
      branches: {
        create: {
          name: 'Cabang Utama Apotek Mitra',
          address: 'Jl. Perintis Kemerdekaan, Makassar',
          phone: '+6281299887766',
          timezone: TZ_ID,
        },
      },
    },
    include: { branches: true },
  });

  const tenantSg = await prisma.tenant.upsert({
    where: { slug: 'greencross-sg' },
    update: {},
    create: {
      slug: 'greencross-sg',
      name: 'GreenCross Clinical Pharmacy SG',
      countryCode: 'SG',
      defaultCurrency: 'SGD',
      defaultLocale: 'en',
      inviteCode: 'DOSE-SG-01',
      brandPrimaryHex: '#0F766E',
      quota: {
        create: {
          planCode: 'CLINIC_PRO',
          maxPatients: 1000,
          maxPharmacists: 15,
          monthlyWaLimit: 5000,
        },
      },
      integrationConfig: {
        create: {
          whatsappEnabled: true,
          whatsappProvider: 'SIMULATOR',
          whatsappSenderId: '+6591230000',
        },
      },
      branches: {
        create: {
          name: 'Orchard Medical Wing',
          address: '290 Orchard Rd, Singapore',
          phone: '+6591230000',
          timezone: TZ_SG,
        },
      },
    },
    include: { branches: true },
  });

  // 2. Super Admin & Verified Pharmacists
  const superAdmin = await upsertUser({
    email: 'admin@dosemate.health',
    password: 'admin1234',
    name: 'Admin Sistem DoseMate',
    phone: '+628110000100',
    globalRole: 'SUPER_ADMIN',
  });

  const pharmacistId = await upsertUser({
    email: 'apoteker@dosemate.health',
    password: 'apoteker1234',
    name: 'Rabiatul Adawiah, S.Farm., Apt.',
    phone: '+6281299887766',
    globalRole: 'PHARMACIST',
  });

  const pharmacistSg = await upsertUser({
    email: 'daniel@greencross.sg',
    password: 'apoteker1234',
    name: 'Dr. Daniel Tan, RPh',
    phone: '+6591234567',
    globalRole: 'PHARMACIST',
    locale: 'en',
    timezone: TZ_SG,
    countryCode: 'SG',
  });

  await prisma.staffMembership.upsert({
    where: { userId_tenantId: { userId: pharmacistId.id, tenantId: tenantId.id } },
    update: { active: true, role: 'OWNER' },
    create: {
      userId: pharmacistId.id,
      tenantId: tenantId.id,
      branchId: tenantId.branches[0]?.id,
      role: 'OWNER',
      active: true,
    },
  });

  await prisma.staffMembership.upsert({
    where: { userId_tenantId: { userId: superAdmin.id, tenantId: tenantId.id } },
    update: { active: true, role: 'TENANT_ADMIN' },
    create: {
      userId: superAdmin.id,
      tenantId: tenantId.id,
      role: 'TENANT_ADMIN',
      active: true,
    },
  });

  await prisma.staffMembership.upsert({
    where: { userId_tenantId: { userId: pharmacistSg.id, tenantId: tenantSg.id } },
    update: { active: true, role: 'OWNER' },
    create: {
      userId: pharmacistSg.id,
      tenantId: tenantSg.id,
      branchId: tenantSg.branches[0]?.id,
      role: 'OWNER',
      active: true,
    },
  });

  // Verified Credentials (Indonesia STRA/SIPA + Singapore RPh)
  const existingCreds = await prisma.pharmacistCredential.count({ where: { userId: pharmacistId.id } });
  if (!existingCreds) {
    await prisma.pharmacistCredential.createMany({
      data: [
        {
          userId: pharmacistId.id,
          countryCode: 'ID',
          licenseType: 'STRA',
          licenseNumber: '19960512/STRA-UNHAS/2021/28491',
          issuingAuthority: 'Konsil Tenaga Kefarmasian Indonesia',
          workplace: 'Instalasi Farmasi Klinis Apotek Mitra',
          specialization: 'Farmasi Klinis, Hipertensi & Terapi Penyakit Kronis',
          yearsExperience: 6,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: superAdmin.id,
        },
        {
          userId: pharmacistId.id,
          countryCode: 'ID',
          licenseType: 'SIPA',
          licenseNumber: '503/SIPA.042/DINKES-MKS/2023',
          issuingAuthority: 'Dinas Kesehatan Kota Makassar',
          workplace: 'Instalasi Farmasi Klinis Apotek Mitra',
          specialization: 'Pemantauan Terapi Obat (PTO)',
          yearsExperience: 6,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: superAdmin.id,
        },
        {
          userId: pharmacistSg.id,
          countryCode: 'SG',
          licenseType: 'RPH',
          licenseNumber: 'SPC-2023-88412',
          issuingAuthority: 'Singapore Pharmacy Council',
          workplace: 'GreenCross Clinical Pharmacy SG',
          specialization: 'Cardiometabolic & Chronic Therapy',
          yearsExperience: 8,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedById: superAdmin.id,
        },
      ],
    });
  }

  // 3. Global Multi-Language Educational Articles & Videos (General Patients — Translation Table Pattern!)
  // Remove any legacy pregnancy-specific slugs if present from earlier seeds
  await prisma.article.deleteMany({
    where: {
      slug: {
        in: [
          'hypertension-pregnancy-warning-signs',
          'antihypertensive-safety-pregnancy',
          'video-preeclampsia-safety',
        ],
      },
    },
  });

  const educationSeed = [
    {
      slug: 'hypertension-warning-signs-monitoring',
      category: 'Disease Education',
      mediaType: 'ARTICLE',
      coverImage: '/images/edu-bp-monitor.svg',
      durationLabel: '4 min',
      drugName: null,
      translations: [
        {
          locale: 'id',
          title: 'Hipertensi & Pemantauan Tekanan Darah: Kenali Tanda Bahayanya',
          summary: 'Panduan pemantauan tekanan darah mandiri di rumah dan tanda bahaya krisis hipertensi yang wajib diwaspadai.',
          body: '### Mengapa Pemantauan Tekanan Darah Penting?\nHipertensi sering berlangsung tanpa gejala. Catat tekanan darah secara rutin setelah duduk tenang selama 5 menit agar apoteker dan dokter dapat mengevaluasi efektivitas terapi.\n\n### Tanda Bahaya Segera ke IGD\n- Tekanan darah ≥160/110 mmHg\n- Sakit kepala hebat yang tidak membaik dengan istirahat\n- Pandangan kabur atau nyeri dada\n- Sesak napas atau kelemahan mendadak.',
        },
        {
          locale: 'en',
          title: 'Hypertension & Blood Pressure Monitoring: Warning Signs',
          summary: 'Home blood pressure tracking guide and critical hypertensive symptoms requiring urgent medical care.',
          body: '### Why Blood Pressure Monitoring Matters\nHypertension often has no obvious symptoms. Rest quietly for 5 minutes before measuring so your pharmacist and clinician can evaluate therapy response.\n\n### Seek Urgent Medical Care If:\n- Blood pressure reaches ≥160/110 mmHg\n- Severe headache unresponsive to rest\n- Blurred vision or chest pain\n- Shortness of breath or sudden weakness.',
        },
      ],
    },
    {
      slug: 'antihypertensive-medication-safety',
      category: 'Medication Information',
      mediaType: 'ARTICLE',
      coverImage: '/images/edu-medications.jpg',
      durationLabel: '3 min',
      drugName: 'Amlodipine / Aspirin',
      translations: [
        {
          locale: 'id',
          title: 'Penggunaan Obat Antihipertensi & Terapi Rutin yang Aman',
          summary: 'Aturan minum, efek samping umum, dan pentingnya menjaga kepatuhan tanpa menghentikan terapi mendadak.',
          body: '### Aturan Minum Aman\nMinum obat pada jam yang sama setiap hari dengan bantuan alarm DoseMate. Jangan mengubah dosis atau berhenti minum obat tanpa konsultasi dokter/apoteker.\n\n### Efek Samping Umum\nPusing ringan saat berdiri atau bengkak ringan pada pergelangan kaki perlu dicatat dan dikonsultasikan di ruang chat apoteker.',
        },
        {
          locale: 'en',
          title: 'Safe Use of Antihypertensive & Chronic Medications',
          summary: 'Dosing timing, common side effects, and why consistent daily adherence protects long-term cardiovascular health.',
          body: '### Safe Dosing Principles\nTake prescribed medicines at the same time daily with DoseMate reminders. Never alter doses or discontinue therapy abruptly without consulting your clinician.\n\n### Managing Side Effects\nLog mild dizziness or ankle swelling and consult your clinical pharmacist directly in DoseMate Chat.',
        },
      ],
    },
    {
      slug: 'calcium-iron-spacing-guide',
      category: 'Medication Use',
      mediaType: 'ARTICLE',
      coverImage: '/images/edu-medications.jpg',
      durationLabel: '3 min',
      drugName: 'Calcium / Iron',
      translations: [
        {
          locale: 'id',
          title: 'Cara Minum Kalsium & Jeda 2 Jam dengan Tablet Zat Besi',
          summary: 'Mengapa kalsium dan zat besi (Fe) tidak boleh diminum bersamaan agar penyerapan tetap optimal.',
          body: '### Interaksi Penyerapan\nKalsium dapat menghambat penyerapan zat besi di saluran cerna. Beri jeda minimal **2 jam** antara suplemen kalsium dan tablet tambah darah (Fe). DoseMate akan memberi peringatan otomatis bila jadwal Anda terlalu berdekatan.',
        },
        {
          locale: 'en',
          title: 'Spacing Calcium & Iron Supplements by at Least 2 Hours',
          summary: 'Why separating daily calcium and iron doses prevents absorption conflict and improves therapy outcomes.',
          body: '### Absorption Interaction\nCalcium competes with iron absorption in the gut. Separate calcium tablets and iron supplements by at least **2 hours**. DoseMate automatically flags spacing conflicts in your schedule.',
        },
      ],
    },
    {
      slug: 'video-home-bp-measurement',
      category: 'Curated Materials',
      mediaType: 'VIDEO',
      coverImage: '/images/edu-bp-monitor.svg',
      videoUrl: 'https://www.youtube.com/embed/0f4v5d8w1qU',
      durationLabel: '3:45',
      drugName: null,
      translations: [
        {
          locale: 'id',
          title: 'Video Panduan: Langkah Tepat Mengukur Tekanan Darah di Rumah',
          summary: 'Demonstrasi duduk tenang 5 menit, posisi manset sejajar jantung, dan pencatatan di DoseMate.',
          body: '1. Duduk tenang 5 menit, punggung bersandar.\n2. Manset sejajar jantung pada lengan atas.\n3. Ukur 2 kali jeda 1 menit dan simpan langsung ke DoseMate.',
        },
        {
          locale: 'en',
          title: 'Video Guide: Step-by-Step Home Blood Pressure Measurement',
          summary: 'Visual walkthrough of 5-minute rest posture, heart-level cuff placement, and DoseMate logging.',
          body: '1. Sit quietly for 5 minutes with back supported.\n2. Place upper-arm cuff at heart level.\n3. Record two readings 1 minute apart directly in DoseMate.',
        },
      ],
    },
    {
      slug: 'video-medication-safety-red-flags',
      category: 'Side Effects & Safety',
      mediaType: 'VIDEO',
      coverImage: '/images/edu-medications.jpg',
      videoUrl: 'https://www.youtube.com/embed/7n3r2wK5v1E',
      durationLabel: '4:15',
      drugName: 'Amlodipine / Aspirin',
      translations: [
        {
          locale: 'id',
          title: 'Video Konseling: Keamanan Obat & Tanda Bahaya Tekanan Darah',
          summary: 'Penjelasan apoteker klinis tentang efek samping obat harian dan gejala darurat yang perlu segera ditangani.',
          body: 'Waspadai sakit kepala hebat, pandangan kabur, nyeri dada, sesak napas, atau tekanan darah ≥160/110 mmHg. Segera hubungi fasilitas kesehatan.',
        },
        {
          locale: 'en',
          title: 'Counseling Video: Medication Safety & Hypertension Red Flags',
          summary: 'Clinical pharmacist overview of expected mild side effects versus urgent symptoms requiring immediate care.',
          body: 'Seek immediate medical care for severe headaches, visual disturbances, chest pain, shortness of breath, or BP ≥160/110 mmHg.',
        },
      ],
    },
  ];

  for (const item of educationSeed) {
    const art = await prisma.article.upsert({
      where: { slug: item.slug },
      update: {
        category: item.category,
        mediaType: item.mediaType,
        coverImage: item.coverImage,
        videoUrl: item.videoUrl ?? null,
        durationLabel: item.durationLabel,
        drugName: item.drugName,
        published: true,
      },
      create: {
        slug: item.slug,
        category: item.category,
        mediaType: item.mediaType,
        coverImage: item.coverImage,
        videoUrl: item.videoUrl ?? null,
        durationLabel: item.durationLabel,
        drugName: item.drugName,
        published: true,
      },
    });
    for (const tr of item.translations) {
      await prisma.articleTranslation.upsert({
        where: { articleId_locale: { articleId: art.id, locale: tr.locale } },
        update: { title: tr.title, summary: tr.summary, body: tr.body },
        create: { articleId: art.id, ...tr },
      });
    }
  }

  // 4. Multi-Language Pharmacy Services (ISO 4217 currency + Translation Table!)
  const servicesSeed = [
    {
      code: 'SVC-PTO',
      category: 'PTO',
      durationMinutes: 30,
      priceMinor: 0,
      currency: 'IDR',
      icon: 'HeartPulse',
      translations: [
        {
          locale: 'id',
          name: 'Pemantauan Terapi Obat (PTO) & Evaluasi Kepatuhan',
          description: 'Evaluasi menyeluruh regimen obat, deteksi DRP, dan pemantauan tren tekanan darah bersama apoteker klinis.',
        },
        {
          locale: 'en',
          name: 'Pharmacotherapy Monitoring (PTO) & Adherence Review',
          description: 'Comprehensive medication review, DRP detection, and clinical blood pressure trend assessment.',
        },
      ],
    },
    {
      code: 'SVC-RECON',
      category: 'RECONCILIATION',
      durationMinutes: 25,
      priceMinor: 0,
      currency: 'IDR',
      icon: 'Calendar',
      translations: [
        {
          locale: 'id',
          name: 'Rekonsiliasi & Optimasi Regimen Terapi Kompleks',
          description: 'Penyelarasan jadwal obat resep, suplemen, dan pencegahan interaksi antar obat (jeda kalsium/zat besi).',
        },
        {
          locale: 'en',
          name: 'Complex Regimen Reconciliation & Schedule Optimization',
          description: 'Alignment of multi-drug regimens and supplements to prevent absorption conflicts and missed doses.',
        },
      ],
    },
    {
      code: 'SVC-TELE',
      category: 'TELEPHARMACY',
      durationMinutes: 20,
      priceMinor: 0,
      currency: 'IDR',
      icon: 'MessageSquare',
      translations: [
        {
          locale: 'id',
          name: 'Konsultasi Telefarmasi & Informasi Obat (PIO)',
          description: 'Tanya jawab langsung dengan apoteker terverifikasi mengenai dosis, efek samping, dan keamanan obat.',
        },
        {
          locale: 'en',
          name: 'Telepharmacy & Drug Information Consultation',
          description: 'Direct consultation with a verified clinical pharmacist on dosing, side effects, and safety.',
        },
      ],
    },
  ];

  const createdServices = [];
  for (const s of servicesSeed) {
    const svc = await prisma.pharmacyService.upsert({
      where: { tenantId_code: { tenantId: tenantId.id, code: s.code } },
      update: { category: s.category, durationMinutes: s.durationMinutes, priceMinor: s.priceMinor, currency: s.currency },
      create: {
        tenantId: tenantId.id,
        code: s.code,
        category: s.category,
        durationMinutes: s.durationMinutes,
        priceMinor: s.priceMinor,
        currency: s.currency,
        icon: s.icon,
      },
    });
    for (const tr of s.translations) {
      await prisma.pharmacyServiceTranslation.upsert({
        where: { serviceId_locale: { serviceId: svc.id, locale: tr.locale } },
        update: { name: tr.name, description: tr.description },
        create: { serviceId: svc.id, ...tr },
      });
    }
    createdServices.push(svc);
  }

  // 5. Cohort of 4 Patients in Indonesia Pharmacy Tenant + 1 Patient in Singapore Tenant (Cross-Tenant Isolation)
  const cohortId = [
    {
      email: 'pasien@dosemate.health',
      phone: '+6281234567890',
      name: 'Aisyah Rahmadani',
      studyCode: 'P-001',
      diagnosis: 'Hipertensi esensial derajat I — pemantauan terapi rutin',
      meds: [
        {
          displayName: 'Aspirin dosis rendah',
          activeIngredient: 'Acetylsalicylic acid',
          drugCode: 'KFA-93000112',
          drugCodeSystem: 'KFA',
          dosage: '80 mg',
          strengthValue: 80,
          strengthUnit: 'mg',
          form: 'Tablet',
          instructions: 'Minum pagi hari setelah sarapan sesuai resep.',
          times: ['07:00'],
          scheduleRule: { type: 'DAILY', mealRelation: 'AFTER_MEAL' },
        },
        {
          displayName: 'Suplemen Kalsium',
          activeIngredient: 'Calcium carbonate',
          drugCode: 'KFA-93000450',
          drugCodeSystem: 'KFA',
          dosage: '500 mg',
          strengthValue: 500,
          strengthUnit: 'mg',
          form: 'Tablet',
          instructions: 'Beri jeda ≥2 jam dari tablet zat besi.',
          times: ['07:00', '19:00'],
          scheduleRule: { type: 'DAILY', mealRelation: 'WITH_MEAL' },
        },
      ],
      adherenceTarget: 0.9,
      bpSeries: [[138, 88, 84], [134, 85, 82], [130, 82, 80], [126, 80, 78], [122, 78, 76]],
      msg: 'Selamat pagi Apoteker, tekanan darah pagi ini 122/78 mmHg dan semua obat sudah saya minum tepat waktu.',
    },
    {
      email: 'siti@dosemate.health',
      phone: '+6281211112222',
      name: 'Siti Rahmawati',
      studyCode: 'P-002',
      diagnosis: 'Hipertensi tidak terkontrol — evaluasi kepatuhan Amlodipine',
      meds: [
        {
          displayName: 'Amlodipine',
          activeIngredient: 'Amlodipine besylate',
          drugCode: 'KFA-93000205',
          drugCodeSystem: 'KFA',
          dosage: '5 mg',
          strengthValue: 5,
          strengthUnit: 'mg',
          form: 'Tablet',
          instructions: 'Minum 1 tablet setiap pagi dan sore sesuai jadwal.',
          times: ['08:00', '20:00'],
          scheduleRule: { type: 'DAILY', mealRelation: 'ANYTIME' },
        },
      ],
      adherenceTarget: 0.6,
      bpSeries: [[154, 98, 88], [150, 95, 86], [148, 94, 85], [152, 96, 87], [150, 95, 84]],
      msg: 'Halo, saya ingin bertanya mengenai efek samping Amlodipine, apakah normal jika saya merasa sedikit pusing?',
    },
    {
      email: 'dewi@dosemate.health',
      phone: '+6281233334444',
      name: 'Dewi Lestari',
      studyCode: 'P-003',
      diagnosis: 'Hipertensi kronis — pemantauan terapi antihipertensi',
      meds: [
        {
          displayName: 'Metildopa',
          activeIngredient: 'Methyldopa',
          drugCode: 'KFA-93000310',
          drugCodeSystem: 'KFA',
          dosage: '250 mg',
          strengthValue: 250,
          strengthUnit: 'mg',
          form: 'Tablet',
          instructions: 'Minum rutin 2 kali sehari.',
          times: ['07:00', '19:00'],
          scheduleRule: { type: 'DAILY', mealRelation: 'AFTER_MEAL' },
        },
      ],
      adherenceTarget: 0.7,
      bpSeries: [[144, 92, 82], [142, 90, 81], [138, 88, 80], [141, 90, 82], [140, 90, 80]],
      msg: 'Kemarin malam sempat terlambat minum obat 1 jam, hari ini sudah kembali sesuai jadwal.',
    },
    {
      email: 'nur@dosemate.health',
      phone: '+6281255556666',
      name: 'Nur Aisyah',
      studyCode: 'P-004',
      diagnosis: 'Terapi pencegahan kardiovaskular & kontrol tekanan darah',
      meds: [
        {
          displayName: 'Aspirin dosis rendah',
          activeIngredient: 'Acetylsalicylic acid',
          drugCode: 'KFA-93000112',
          drugCodeSystem: 'KFA',
          dosage: '80 mg',
          strengthValue: 80,
          strengthUnit: 'mg',
          form: 'Tablet',
          instructions: 'Minum 1 kali sehari setelah sarapan.',
          times: ['07:30'],
          scheduleRule: { type: 'DAILY', mealRelation: 'AFTER_MEAL' },
        },
      ],
      adherenceTarget: 0.75,
      bpSeries: [[136, 86, 78], [134, 85, 76], [132, 84, 77], [135, 85, 79], [135, 85, 76]],
      msg: 'Terima kasih pengingat DoseMate, sangat membantu saya menjaga jadwal obat harian.',
    },
  ];

  for (const item of cohortId) {
    const user = await upsertUser({
      email: item.email,
      password: 'pasien1234',
      name: item.name,
      phone: item.phone,
      globalRole: 'PATIENT',
      locale: 'id',
      timezone: TZ_ID,
      countryCode: 'ID',
    });

    const profile = await prisma.patientProfile.upsert({
      where: { userId: user.id },
      update: { diagnosis: item.diagnosis, estimatedDueDate: null },
      create: {
        userId: user.id,
        gender: 'FEMALE',
        diagnosis: item.diagnosis,
        baselineSystolic: item.bpSeries[0]?.[0] ?? 130,
        baselineDiastolic: item.bpSeries[0]?.[1] ?? 84,
      },
    });

    await prisma.careEnrollment.upsert({
      where: { patientId_tenantId: { patientId: profile.id, tenantId: tenantId.id } },
      update: { pharmacistId: pharmacistId.id, status: 'ACTIVE', studyCode: item.studyCode },
      create: {
        patientId: profile.id,
        tenantId: tenantId.id,
        branchId: tenantId.branches[0]?.id,
        pharmacistId: pharmacistId.id,
        studyCode: item.studyCode,
        studyGroup: 'INTERVENTION',
        status: 'ACTIVE',
      },
    });

    const hasMeds = await prisma.medication.count({ where: { patientId: profile.id } });
    if (!hasMeds) {
      const start = DateTime.now().setZone(TZ_ID).startOf('day').minus({ days: 7 });
      const now = new Date();
      for (const m of item.meds) {
        const med = await prisma.medication.create({
          data: {
            patientId: profile.id,
            tenantId: tenantId.id,
            ...m,
            startDate: start.toJSDate(),
            createdById: pharmacistId.id,
          },
        });
        const doseRows = [];
        let seq = 0;
        for (let d = 0; d <= 7; d++) {
          const day = start.plus({ days: d });
          const localDate = day.toISODate()!;
          for (const tStr of m.times) {
            const [hh = 7, mm = 0] = tStr.split(':').map(Number);
            const at = day.set({ hour: hh, minute: mm, second: 0, millisecond: 0 });
            const isToday = d === 7;
            seq++;
            const ratio = ((seq * 37) % 100) / 100;
            const status = isToday
              ? at.toJSDate() < now
                ? 'TAKEN'
                : 'PENDING'
              : ratio < item.adherenceTarget
              ? 'TAKEN'
              : ratio < item.adherenceTarget + 0.12
              ? 'SKIPPED'
              : 'MISSED';
            doseRows.push({
              medicationId: med.id,
              patientId: profile.id,
              scheduledAt: at.toJSDate(),
              localDate,
              localTime: tStr,
              timezone: TZ_ID,
              status: status as 'PENDING' | 'TAKEN' | 'SKIPPED' | 'MISSED',
              takenAt: status === 'TAKEN' ? at.plus({ minutes: 8 }).toJSDate() : null,
              clientConfirmedAt: status === 'TAKEN' ? at.plus({ minutes: 8 }).toJSDate() : null,
              serverReceivedAt: status === 'TAKEN' ? at.plus({ minutes: 8 }).toJSDate() : null,
            });
          }
        }
        await prisma.doseLog.createMany({ data: doseRows, skipDuplicates: true });
      }

      await prisma.bloodPressureLog.createMany({
        data: item.bpSeries.map(([sys = 120, dia = 80, pulse = 78], idx) => ({
          patientId: profile.id,
          systolic: sys,
          diastolic: dia,
          pulse,
          measuredAt: DateTime.now()
            .setZone(TZ_ID)
            .startOf('day')
            .minus({ days: item.bpSeries.length - 1 - idx })
            .set({ hour: 8, minute: 20 })
            .toJSDate(),
          source: idx === 0 ? 'CLINIC' : 'SELF',
          alertStatus: sys >= 160 || dia >= 110 ? 'PENDING_ACK' : 'NONE',
        })),
      });

      await prisma.message.createMany({
        data: [
          {
            tenantId: tenantId.id,
            patientId: profile.id,
            senderId: user.id,
            body: item.msg,
            createdAt: DateTime.now().setZone(TZ_ID).minus({ hours: 3 }).toJSDate(),
          },
          {
            tenantId: tenantId.id,
            patientId: profile.id,
            senderId: pharmacistId.id,
            body: 'Halo, terima kasih sudah menghubungi kami. Pusing ringan memang bisa terjadi di awal terapi. Jika berlanjut atau semakin berat, segera hubungi fasilitas kesehatan ya.',
            createdAt: DateTime.now().setZone(TZ_ID).minus({ hours: 2, minutes: 45 }).toJSDate(),
          },
        ],
      });

      if (item.studyCode === 'P-001') {
        await prisma.patientAllergy.create({
          data: {
            patientId: profile.id,
            substanceName: 'Penicillin (Amoxicillin)',
            substanceCode: 'ATC-J01CA04',
            severity: 'MODERATE',
            reaction: 'Ruam kulit ringan',
          },
        });
        await prisma.healthParameterLog.createMany({
          data: [63.2, 63.8, 64.2, 64.7].map((w, i) => ({
            patientId: profile.id,
            type: 'WEIGHT',
            value: w,
            unit: 'kg',
            source: 'SELF',
            measuredAt: DateTime.now().setZone(TZ_ID).minus({ days: (3 - i) * 4 }).toJSDate(),
          })),
        });
        await prisma.checkupReminder.createMany({
          data: [
            {
              patientId: profile.id,
              tenantId: tenantId.id,
              createdById: pharmacistId.id,
              title: 'Kontrol Rutin & Evaluasi Tekanan Darah',
              type: 'CHECKUP',
              scheduledAt: DateTime.now().setZone(TZ_ID).plus({ days: 3 }).set({ hour: 9, minute: 30 }).toJSDate(),
              location: 'Klinik & Apotek Mitra',
              status: 'UPCOMING',
            },
            {
              patientId: profile.id,
              tenantId: tenantId.id,
              createdById: pharmacistId.id,
              title: 'Evaluasi Pemantauan Terapi Obat (PTO)',
              type: 'FOLLOW_UP',
              scheduledAt: DateTime.now().setZone(TZ_ID).plus({ days: 7 }).set({ hour: 10, minute: 0 }).toJSDate(),
              location: 'Telefarmasi DoseMate',
              status: 'UPCOMING',
            },
          ],
        });
        if (createdServices[0]) {
          await prisma.serviceRequest.create({
            data: {
              tenantId: tenantId.id,
              patientId: profile.id,
              serviceId: createdServices[0].id,
              pharmacistId: pharmacistId.id,
              preferredDate: DateTime.now().setZone(TZ_ID).plus({ days: 2 }).toJSDate(),
              complaint: 'Ingin evaluasi jadwal minum kalsium dan aspirin minggu ini.',
              status: 'CONFIRMED',
              pharmacistReply: 'Jadwal PTO dikonfirmasi. Mohon ukur tekanan darah pagi sebelum sesi.',
            },
          });
        }
        await prisma.patientFollowUp.create({
          data: {
            tenantId: tenantId.id,
            patientId: profile.id,
            pharmacistId: pharmacistId.id,
            type: 'PTO_REPORT',
            subjective: 'Tidak ada sakit kepala berat atau gangguan penglihatan.',
            objective: 'TD terakhir 122/78 mmHg (Terkontrol). Kepatuhan 7 hari ~90%.',
            assessment: 'Terapi antihipertensi dan suplementasi harian efektif serta ditoleransi dengan baik.',
            plan: 'Lanjutkan Aspirin 80 mg pagi & Kalsium 500 mg 2x1 dengan jeda minimal 2 jam dari zat besi.',
            drpCategory: 'NONE',
            recommendation: 'Pertahankan alarm DoseMate dan ukur tekanan darah 2x seminggu.',
            adherenceRate: 90,
            latestBp: '122/78 mmHg',
            nextFollowUpDate: DateTime.now().setZone(TZ_ID).plus({ days: 7 }).toJSDate(),
          },
        });
      }
    }
  }

  // Singapore Patient (strictly isolated in tenantSg!)
  const sgPatientUser = await upsertUser({
    email: 'chloe@greencross.sg',
    password: 'pasien1234',
    name: 'Chloe Lim',
    phone: '+6598765432',
    globalRole: 'PATIENT',
    locale: 'en',
    timezone: TZ_SG,
    countryCode: 'SG',
  });
  const sgProfile = await prisma.patientProfile.upsert({
    where: { userId: sgPatientUser.id },
    update: {},
    create: {
      userId: sgPatientUser.id,
      gender: 'FEMALE',
      diagnosis: 'Essential hypertension — routine pharmacy follow-up',
    },
  });
  await prisma.careEnrollment.upsert({
    where: { patientId_tenantId: { patientId: sgProfile.id, tenantId: tenantSg.id } },
    update: { pharmacistId: pharmacistSg.id, status: 'ACTIVE', studyCode: 'SG-001' },
    create: {
      patientId: sgProfile.id,
      tenantId: tenantSg.id,
      branchId: tenantSg.branches[0]?.id,
      pharmacistId: pharmacistSg.id,
      studyCode: 'SG-001',
      status: 'ACTIVE',
    },
  });

  // Idempotent cleanup for previously seeded dev databases
  await prisma.branch.updateMany({
    where: { name: 'Cabang Utama RSIA Mitra' },
    data: { name: 'Cabang Utama Apotek Mitra' },
  });
  await prisma.pharmacistCredential.updateMany({
    where: { workplace: 'Instalasi Farmasi Klinis RSIA Mitra' },
    data: { workplace: 'Instalasi Farmasi Klinis Apotek Mitra' },
  });
  await prisma.pharmacistCredential.updateMany({
    where: { specialization: { contains: 'Kehamilan' } },
    data: { specialization: 'Farmasi Klinis, Hipertensi & Terapi Penyakit Kronis' },
  });
  await prisma.checkupReminder.updateMany({
    where: { title: 'Kontrol Antenatal (ANC) & Evaluasi Tekanan Darah' },
    data: {
      title: 'Kontrol Rutin & Evaluasi Tekanan Darah',
      location: 'Klinik & Apotek Mitra',
    },
  });
  await prisma.patientFollowUp.updateMany({
    where: { assessment: { contains: 'preeklampsia' } },
    data: {
      assessment: 'Terapi antihipertensi dan suplementasi harian efektif serta ditoleransi dengan baik.',
    },
  });

  console.log('DoseMate v2 seed complete!');
  console.log('  Tenant 1 (ID): Apotek & Farmasi Klinis Mitra [Invite: DOSE-MKS-01]');
  console.log('  Tenant 2 (SG): GreenCross Clinical Pharmacy SG [Invite: DOSE-SG-01]');
  console.log('  Patient (ID):    pasien@dosemate.health / pasien1234');
  console.log('  Pharmacist (ID): apoteker@dosemate.health / apoteker1234');
  console.log('  Pharmacist (SG): daniel@greencross.sg / apoteker1234');
  console.log('  Super Admin:     admin@dosemate.health / admin1234');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

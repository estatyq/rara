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
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, passwordHash, ...data } });
}

async function main() {
  const admin = await upsertUser({ email: 'admin@rara.local', password: 'admin123', name: 'Admin Peneliti', role: 'ADMIN' });
  const pharmacist = await upsertUser({
    email: 'apoteker@rara.local',
    password: 'apoteker123',
    name: 'apt. Rara Ganie',
    role: 'PHARMACIST',
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
    email: 'pasien@rara.local',
    password: 'pasien123',
    phone: '+6281234567890',
    name: 'Budi Santoso',
    role: 'PATIENT',
    timezone: TZ,
  });
  let patient = await prisma.patient.findUnique({ where: { userId: patientUser.id } });
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        userId: patientUser.id,
        pharmacistId: pharmacist.id,
        studyCode: 'P-001',
        dateOfBirth: DateTime.fromISO('1968-04-12', { zone: TZ }).toJSDate(),
        gender: 'MALE',
        address: 'Jl. Merdeka No. 10, Bandung',
        diagnosis: 'Hipertensi, Diabetes melitus tipe 2',
        allergies: 'Tidak ada',
      },
    });
  }

  const hasMeds = await prisma.medication.count({ where: { patientId: patient.id } });
  if (!hasMeds) {
    const start = DateTime.now().setZone(TZ).startOf('day').minus({ days: 14 });
    const amlo = await prisma.article.findUnique({ where: { slug: 'amlodipin' } });
    const metf = await prisma.article.findUnique({ where: { slug: 'metformin' } });
    const meds = await Promise.all([
      prisma.medication.create({
        data: {
          patientId: patient.id, name: 'Amlodipin', dosage: '5 mg', form: 'Tablet', instructions: 'Diminum pagi hari, sebelum atau sesudah makan',
          times: ['07:00'], startDate: start.toJSDate(), createdAt: start.toJSDate(), articleId: amlo?.id, createdById: pharmacist.id,
        },
      }),
      prisma.medication.create({
        data: {
          patientId: patient.id, name: 'Metformin', dosage: '500 mg', form: 'Tablet', instructions: 'Diminum bersama atau sesudah makan',
          times: ['07:00', '19:00'], startDate: start.toJSDate(), createdAt: start.toJSDate(), articleId: metf?.id, createdById: pharmacist.id,
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
        { patientId: patient.id, senderId: patientUser.id, body: 'Selamat pagi, apakah metformin boleh diminum sebelum makan?', createdAt: start.plus({ days: 3, hours: 8 }).toJSDate(), readAt: start.plus({ days: 3, hours: 9 }).toJSDate() },
        { patientId: patient.id, senderId: pharmacist.id, body: 'Selamat pagi Pak Budi. Sebaiknya metformin diminum bersama atau segera sesudah makan untuk mengurangi keluhan lambung (mual, perut tidak nyaman).', createdAt: start.plus({ days: 3, hours: 9 }).toJSDate(), readAt: start.plus({ days: 3, hours: 10 }).toJSDate() },
        { patientId: patient.id, senderId: patientUser.id, body: 'Baik, terima kasih Bu.', createdAt: start.plus({ days: 3, hours: 10 }).toJSDate() },
      ],
    });
  }

  console.log('Seed complete.');
  console.log('  Admin:      admin@rara.local / admin123');
  console.log('  Pharmacist: apoteker@rara.local / apoteker123');
  console.log('  Patient:    pasien@rara.local (or 081234567890) / pasien123');
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

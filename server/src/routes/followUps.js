import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireStaff, resolvePatient } from '../auth.js';
import { notFound } from '../errors.js';
import { adherenceFor } from '../doses.js';
import { sendWhatsAppMessage, formatWaMeUrl } from '../whatsapp.js';
import { logAudit } from '../audit.js';
import { emitToPatient } from '../realtime.js';

export const patientScoped = Router({ mergeParams: true });
export const flat = Router();

const emptyToNull = (v) => (v === '' ? null : v);

const followUpSchema = z.object({
  type: z.enum(['FOLLOW_UP', 'PTO_REPORT', 'COUNSELING', 'DRP_INTERVENTION']).default('PTO_REPORT'),
  subjective: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  objective: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  assessment: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  plan: z.string().trim().min(3).max(3000),
  drpCategory: z
    .enum([
      'NONE',
      'NON_ADHERENCE',
      'ADVERSE_DRUG_REACTION',
      'SUBOPTIMAL_DOSAGE',
      'DRUG_INTERACTION',
      'NEEDS_ADDITIONAL_THERAPY',
    ])
    .default('NONE'),
  recommendation: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  nextFollowUpDate: z.preprocess(emptyToNull, z.string().nullable().optional()),
  sendToChat: z.boolean().optional(),
  sendViaWhatsApp: z.boolean().optional(),
});

// Get follow-ups / PTO reports for a patient
patientScoped.get('/follow-ups', resolvePatient, async (req, res) => {
  const followUps = await prisma.patientFollowUp.findMany({
    where: { patientId: req.patient.id },
    include: {
      pharmacist: {
        select: { id: true, name: true, email: true, phone: true, pharmacistProfile: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ followUps });
});

// Create a clinical follow-up or Pharmacotherapy Monitoring Report (PTO)
patientScoped.post('/follow-ups', requireStaff, resolvePatient, async (req, res) => {
  const data = followUpSchema.parse(req.body);

  // Capture live 30d adherence & latest BP snapshot automatically
  const [adh, latestBpLog] = await Promise.all([
    adherenceFor(req.patient.id, req.patient.user.timezone, 30),
    prisma.bloodPressureLog.findFirst({
      where: { patientId: req.patient.id },
      orderBy: { measuredAt: 'desc' },
    }),
  ]);

  const latestBpStr = latestBpLog ? `${latestBpLog.systolic}/${latestBpLog.diastolic} mmHg` : null;
  const nextDate = data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null;

  const followUp = await prisma.patientFollowUp.create({
    data: {
      patientId: req.patient.id,
      pharmacistId: req.user.id,
      type: data.type,
      subjective: data.subjective || null,
      objective: data.objective || null,
      assessment: data.assessment || null,
      plan: data.plan,
      drpCategory: data.drpCategory,
      recommendation: data.recommendation || null,
      adherenceRate: adh?.rate ?? null,
      latestBp: latestBpStr,
      nextFollowUpDate: nextDate && !Number.isNaN(+nextDate) ? nextDate : null,
      sentViaWhatsApp: Boolean(data.sendViaWhatsApp),
    },
    include: {
      pharmacist: {
        select: { id: true, name: true, email: true, phone: true, pharmacistProfile: true },
      },
    },
  });

  if (data.sendToChat) {
    const summaryMsg = `[Tindak Lanjut Farmakoterapi / PTO]\n• Rencana (Plan): ${data.plan}${
      data.recommendation ? `\n• Rekomendasi Apoteker: ${data.recommendation}` : ''
    }`;
    await prisma.message.create({
      data: {
        patientId: req.patient.id,
        senderId: req.user.id,
        body: summaryMsg,
      },
    });
  }

  if (data.sendViaWhatsApp) {
    const pUser = await prisma.user.findUnique({ where: { id: req.patient.userId } });
    if (pUser?.phone) {
      const waMsg =
        pUser.locale === 'en'
          ? `[Apoteku Pharmacist Follow-Up] Hello ${pUser.name}, ${req.user.name} has recorded a pharmacotherapy follow-up.\nPlan: ${data.plan}${data.recommendation ? `\nRecommendation: ${data.recommendation}` : ''}`
          : `[Tindak Lanjut Apoteker Apoteku] Halo ${pUser.name}, Apoteker ${req.user.name} telah mencatat evaluasi terapi obat Anda.\nRencana Terapi: ${data.plan}${data.recommendation ? `\nRekomendasi: ${data.recommendation}` : ''}`;
      await sendWhatsAppMessage({
        phone: pUser.phone,
        message: waMsg,
        category: 'FOLLOW_UP',
        userId: pUser.id,
        patientId: req.patient.id,
      });
    }
  }

  emitToPatient(req.patient.id, 'followup:created', followUp);
  await logAudit(req.user, 'CREATE_FOLLOW_UP', 'PatientFollowUp', followUp.id, {
    patientId: req.patient.id,
    type: followUp.type,
    drpCategory: followUp.drpCategory,
  });

  res.status(201).json({ followUp });
});

flat.delete('/follow-ups/:id', requireStaff, async (req, res) => {
  const existing = await prisma.patientFollowUp.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound('Follow-up record not found');
  await prisma.patientFollowUp.delete({ where: { id: existing.id } });
  await logAudit(req.user, 'DELETE_FOLLOW_UP', 'PatientFollowUp', existing.id);
  res.json({ ok: true });
});

// Patient-scoped WhatsApp log & direct send
patientScoped.get('/whatsapp-logs', resolvePatient, async (req, res) => {
  const logs = await prisma.whatsAppLog.findMany({
    where: {
      OR: [{ patientId: req.patient.id }, { userId: req.patient.userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const pUser = await prisma.user.findUnique({ where: { id: req.patient.userId }, select: { phone: true, whatsappOptIn: true } });
  res.json({
    logs,
    phone: pUser?.phone || null,
    whatsappOptIn: pUser?.whatsappOptIn ?? true,
    waMeUrl: formatWaMeUrl(pUser?.phone),
  });
});

patientScoped.post('/whatsapp-send', requireStaff, resolvePatient, async (req, res) => {
  const { message, category } = z
    .object({
      message: z.string().trim().min(2).max(2000),
      category: z.enum(['DOSE_REMINDER', 'BP_ALERT', 'FOLLOW_UP', 'CONSULTATION', 'SYSTEM']).default('FOLLOW_UP'),
    })
    .parse(req.body);

  const pUser = await prisma.user.findUnique({ where: { id: req.patient.userId } });
  if (!pUser?.phone) {
    return res.status(400).json({ error: 'Patient does not have a phone/WhatsApp number configured' });
  }

  const log = await sendWhatsAppMessage({
    phone: pUser.phone,
    message,
    category,
    userId: pUser.id,
    patientId: req.patient.id,
  });

  res.status(201).json({ log, waMeUrl: formatWaMeUrl(pUser.phone, message) });
});

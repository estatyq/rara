import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireStaff, resolvePatient } from '../auth.js';
import { HttpError, forbidden, notFound } from '../errors.js';

export const router = Router();
export const patientScoped = Router({ mergeParams: true });

const optionSchema = z.object({
  value: z.string().min(1),
  textId: z.string().min(1),
  textEn: z.string().min(1),
  score: z.number().int().default(0),
});

const questionSchema = z.object({
  id: z.string().min(1),
  textId: z.string().min(1),
  textEn: z.string().min(1),
  options: z.array(optionSchema).min(2),
});

const questionnaireSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]+$/).max(50),
  titleId: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  descriptionId: z.string().max(2000).nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  questions: z
    .array(questionSchema)
    .min(1)
    .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, 'Question ids must be unique'),
  active: z.boolean().optional(),
});

router.get('/', async (req, res) => {
  const where = isStaff(req.user) && req.query.all === '1' ? {} : { active: true };
  const questionnaires = await prisma.questionnaire.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { responses: true } } },
  });
  res.json({ questionnaires });
});

router.get('/:id', async (req, res) => {
  const questionnaire = await prisma.questionnaire.findUnique({ where: { id: req.params.id } });
  if (!questionnaire || (!questionnaire.active && !isStaff(req.user))) throw notFound();
  res.json({ questionnaire });
});

router.post('/', requireStaff, async (req, res) => {
  const questionnaire = await prisma.questionnaire.create({ data: questionnaireSchema.parse(req.body) });
  res.status(201).json({ questionnaire });
});

router.patch('/:id', requireStaff, async (req, res) => {
  const data = questionnaireSchema.partial().parse(req.body);
  if (data.questions) {
    const count = await prisma.questionnaireResponse.count({ where: { questionnaireId: req.params.id } });
    if (count) throw new HttpError(409, 'Questions cannot be changed after responses were collected. Create a new questionnaire instead.');
  }
  const questionnaire = await prisma.questionnaire.update({ where: { id: req.params.id }, data });
  res.json({ questionnaire });
});

router.get('/:id/responses', requireStaff, async (req, res) => {
  const responses = await prisma.questionnaireResponse.findMany({
    where: { questionnaireId: req.params.id },
    include: { patient: { select: { id: true, studyCode: true, user: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ responses });
});

// Submit: only the patient themself
router.post('/:id/responses', async (req, res) => {
  if (!req.user.patient) throw forbidden('Only patients can submit responses');
  const questionnaire = await prisma.questionnaire.findUnique({ where: { id: req.params.id } });
  if (!questionnaire || !questionnaire.active) throw notFound();
  const { answers } = z.object({ answers: z.record(z.string()) }).parse(req.body);

  let score = 0;
  const clean = {};
  for (const q of questionnaire.questions) {
    const value = answers[q.id];
    const opt = q.options.find((o) => o.value === value);
    if (!opt) throw new HttpError(400, `Missing answer for question ${q.id}`);
    clean[q.id] = value;
    score += opt.score ?? 0;
  }
  const response = await prisma.questionnaireResponse.create({
    data: { questionnaireId: questionnaire.id, patientId: req.user.patient.id, answers: clean, score },
  });
  res.status(201).json({ response });
});

patientScoped.get('/responses', resolvePatient, async (req, res) => {
  const responses = await prisma.questionnaireResponse.findMany({
    where: { patientId: req.patient.id },
    include: { questionnaire: { select: { id: true, code: true, titleId: true, titleEn: true, questions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ responses });
});

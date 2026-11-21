import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireStaff } from '../auth.js';
import { notFound } from '../errors.js';

const router = Router();

const emptyToNull = (v) => (v === '' ? null : v);

const articleSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and dashes')
    .max(100),
  category: z.string().trim().min(1).max(80),
  mediaType: z.enum(['ARTICLE', 'VIDEO']).default('ARTICLE'),
  coverImage: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  videoUrl: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  durationLabel: z.preprocess(emptyToNull, z.string().trim().max(50).nullable().optional()),
  drugName: z.preprocess(emptyToNull, z.string().trim().max(100).nullable().optional()),
  titleId: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  summaryId: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  summaryEn: z.preprocess(emptyToNull, z.string().trim().max(500).nullable().optional()),
  bodyId: z.string().min(1).max(50000),
  bodyEn: z.string().min(1).max(50000),
  published: z.boolean().optional(),
});

const listSelect = {
  id: true, slug: true, category: true, mediaType: true, coverImage: true, videoUrl: true, durationLabel: true,
  drugName: true, titleId: true, titleEn: true, summaryId: true, summaryEn: true, published: true, updatedAt: true,
};

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const where = {};
  if (!isStaff(req.user)) where.published = true;
  if (req.query.category) where.category = req.query.category.toString();
  if (req.query.mediaType && ['ARTICLE', 'VIDEO'].includes(String(req.query.mediaType))) {
    where.mediaType = String(req.query.mediaType);
  }
  if (q) {
    where.OR = ['titleId', 'titleEn', 'drugName', 'summaryId', 'summaryEn', 'bodyId', 'bodyEn'].map((f) => ({
      [f]: { contains: q, mode: 'insensitive' },
    }));
  }
  const articles = await prisma.article.findMany({ where, select: listSelect, orderBy: [{ category: 'asc' }, { titleId: 'asc' }] });
  const categories = await prisma.article.groupBy({
    by: ['category'],
    where: isStaff(req.user) ? {} : { published: true },
    orderBy: { category: 'asc' },
  });
  res.json({ articles, categories: categories.map((c) => c.category) });
});

router.get('/:key', async (req, res) => {
  const article = await prisma.article.findFirst({ where: { OR: [{ id: req.params.key }, { slug: req.params.key }] } });
  if (!article || (!article.published && !isStaff(req.user))) throw notFound('Article not found');
  res.json({ article });
});

router.post('/', requireStaff, async (req, res) => {
  const article = await prisma.article.create({ data: articleSchema.parse(req.body) });
  res.status(201).json({ article });
});

router.patch('/:id', requireStaff, async (req, res) => {
  const article = await prisma.article.update({ where: { id: req.params.id }, data: articleSchema.partial().parse(req.body) });
  res.json({ article });
});

router.delete('/:id', requireStaff, async (req, res) => {
  await prisma.article.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;

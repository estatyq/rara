import { prisma } from '@dosemate/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../lib/auth.js';
import { notFound } from '../lib/errors.js';

export async function educationRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (req) => {
    const q = z.object({
      locale: z.enum(['id', 'en']).default(req.auth.locale),
      mediaType: z.enum(['ARTICLE', 'VIDEO']).optional(),
      category: z.string().optional(),
      q: z.string().trim().optional(),
    }).parse(req.query);

    const rows = await prisma.article.findMany({
      where: {
        published: true,
        ...(q.mediaType ? { mediaType: q.mediaType } : {}),
        ...(q.category ? { category: q.category } : {}),
        ...(q.q
          ? {
              OR: [
                { drugName: { contains: q.q, mode: 'insensitive' } },
                { translations: { some: { title: { contains: q.q, mode: 'insensitive' } } } },
                { translations: { some: { summary: { contains: q.q, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      include: { translations: true },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    const categories = [...new Set(rows.map((r) => r.category))].sort();
    const articles = rows.map((r) => {
      const tr = r.translations.find((x) => x.locale === q.locale) ?? r.translations[0];
      return {
        id: r.id,
        slug: r.slug,
        category: r.category,
        mediaType: r.mediaType,
        coverImage: r.coverImage,
        videoUrl: r.videoUrl,
        durationLabel: r.durationLabel,
        drugName: r.drugName,
        title: tr?.title ?? r.slug,
        summary: tr?.summary ?? null,
      };
    });

    return { articles, categories };
  });

  app.get('/:slug', { preHandler: [authenticate] }, async (req) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const { locale } = z.object({ locale: z.enum(['id', 'en']).default(req.auth.locale) }).parse(req.query);

    const row = await prisma.article.findFirst({
      where: { OR: [{ slug }, { id: slug }], published: true },
      include: { translations: true },
    });
    if (!row) throw notFound('Educational material not found');

    const tr = row.translations.find((x) => x.locale === locale) ?? row.translations[0];
    return {
      article: {
        id: row.id,
        slug: row.slug,
        category: row.category,
        mediaType: row.mediaType,
        coverImage: row.coverImage,
        videoUrl: row.videoUrl,
        durationLabel: row.durationLabel,
        drugName: row.drugName,
        title: tr?.title ?? row.slug,
        summary: tr?.summary ?? null,
        body: tr?.body ?? '',
      },
    };
  });
}

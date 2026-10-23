import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { sendPushToUser } from '../push.js';
import { tr } from '../i18n.js';

const router = Router();

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

router.post('/subscribe', async (req, res) => {
  const s = subSchema.parse(req.body?.subscription ?? req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: s.endpoint },
    create: { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userId: req.user.id },
    update: { p256dh: s.keys.p256dh, auth: s.keys.auth, userId: req.user.id },
  });
  res.json({ ok: true });
});

router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  res.json({ ok: true });
});

router.post('/test', async (req, res) => {
  const t = tr(req.user.locale);
  const devices = await sendPushToUser(req.user.id, { title: t.testTitle, body: t.testBody, url: '/', tag: 'test' });
  res.json({ devices });
});

export default router;

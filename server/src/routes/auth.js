import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticate, publicUser, signToken } from '../auth.js';
import { HttpError } from '../errors.js';
import { isValidTimezone } from '../time.js';
import { rematerializePatient } from '../doses.js';

const router = Router();

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^\+?\d{8,15}$/.test(v), 'Invalid phone number');

export const normalizePhone = (p) => {
  if (!p) return p;
  let v = p.replace(/[\s-]/g, '');
  // Indonesian numbers: 08xx -> +628xx, 628xx -> +628xx
  if (v.startsWith('0')) v = `+62${v.slice(1)}`;
  else if (v.startsWith('62')) v = `+${v}`;
  return v;
};

const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.preprocess(emptyToUndef, z.string().trim().toLowerCase().email().optional()),
    phone: z.preprocess(emptyToUndef, phone.optional()),
    password: z.string().min(6).max(100),
    locale: z.enum(['id', 'en']).default('id'),
    timezone: z.string().refine(isValidTimezone).default('Asia/Jakarta'),
  })
  .refine((d) => d.email || d.phone, { message: 'Email or phone is required', path: ['email'] });

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: normalizePhone(data.phone),
      passwordHash: await bcrypt.hash(data.password, 10),
      locale: data.locale,
      timezone: data.timezone,
      role: 'PATIENT',
      patient: { create: {} },
    },
    include: { patient: { select: { id: true } } },
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

const loginSchema = z.object({ login: z.string().trim().min(3), password: z.string().min(1) });

router.post('/login', async (req, res) => {
  const { login, password } = loginSchema.parse(req.body);
  const where = login.includes('@') ? { email: login.toLowerCase() } : { phone: normalizePhone(login) };
  const user = await prisma.user.findUnique({ where, include: { patient: { select: { id: true } } } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid login or password');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.preprocess(emptyToUndef, z.string().trim().toLowerCase().email().optional()),
  phone: z.preprocess(emptyToUndef, phone.optional()),
  locale: z.enum(['id', 'en']).optional(),
  timezone: z.string().refine(isValidTimezone).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(100).optional(),
});

router.patch('/me', authenticate, async (req, res) => {
  const data = updateMeSchema.parse(req.body);
  const update = {
    name: data.name,
    email: data.email,
    phone: data.phone ? normalizePhone(data.phone) : undefined,
    locale: data.locale,
    timezone: data.timezone,
  };
  if (data.newPassword) {
    if (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, req.user.passwordHash))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    update.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: update,
    include: { patient: { select: { id: true } } },
  });
  if (data.timezone && data.timezone !== req.user.timezone && user.patient) {
    await rematerializePatient(user.patient.id);
  }
  res.json({ user: publicUser(user) });
});

export default router;

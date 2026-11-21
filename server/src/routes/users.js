import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { publicUser, requireRole, requireStaff } from '../auth.js';
import { HttpError } from '../errors.js';
import { normalizePhone } from './auth.js';

const router = Router();
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);

// Staff list is visible to all staff (needed for assigning patients)
router.get('/staff', requireStaff, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ['PHARMACIST', 'ADMIN'] } },
    orderBy: { name: 'asc' },
    include: {
      pharmacistProfile: true,
      _count: { select: { assignedPatients: true } },
    },
  });
  res.json({ users: users.map(publicUser) });
});

const createSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.preprocess(emptyToUndef, z.string().trim().toLowerCase().email().optional()),
    phone: z.preprocess(emptyToUndef, z.string().trim().min(8).max(20).optional()),
    password: z.string().min(6).max(100),
    role: z.enum(['PHARMACIST', 'ADMIN']).default('PHARMACIST'),
    locale: z.enum(['id', 'en']).default('id'),
  })
  .refine((d) => d.email || d.phone, { message: 'Email or phone is required', path: ['email'] });

router.post('/staff', requireRole('ADMIN'), async (req, res) => {
  const { password, ...d } = createSchema.parse(req.body);
  const user = await prisma.user.create({
    data: { ...d, phone: normalizePhone(d.phone), passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({ user: publicUser(user) });
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['PHARMACIST', 'ADMIN']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
});

// Admin can (de)activate any user, including patients.
router.patch('/:id', requireRole('ADMIN'), async (req, res) => {
  const d = updateSchema.parse(req.body);
  if (req.params.id === req.user.id && (d.active === false || (d.role && d.role !== 'ADMIN'))) {
    throw new HttpError(400, 'You cannot deactivate or demote yourself');
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw new HttpError(404, 'User not found');
  if (d.role && target.role === 'PATIENT') throw new HttpError(400, 'Cannot change the role of a patient');
  const data = { name: d.name, role: d.role, active: d.active };
  if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ user: publicUser(user) });
});

export default router;

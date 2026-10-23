import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { prisma } from './db.js';
import { HttpError, forbidden, notFound } from './errors.js';

export const isStaff = (user) => user?.role === 'PHARMACIST' || user?.role === 'ADMIN';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
}

export function publicUser(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function userFromToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (!payload?.sub) throw new Error('bad token');
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { patient: { select: { id: true } } },
  });
  if (!user || !user.active) throw new Error('inactive');
  return user;
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Unauthorized');
  try {
    req.user = await userFromToken(token);
  } catch {
    throw new HttpError(401, 'Unauthorized');
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) throw forbidden();
  next();
};

export const requireStaff = requireRole('PHARMACIST', 'ADMIN');

/**
 * Resolves :patientId ("me" or an id) into req.patient with the user's timezone.
 * Patients may only access themselves; staff may access everyone.
 */
export async function resolvePatient(req, res, next) {
  const param = req.params.patientId;
  let patientId;
  if (param === 'me') {
    if (!req.user.patient) throw forbidden('Not a patient account');
    patientId = req.user.patient.id;
  } else if (isStaff(req.user) || req.user.patient?.id === param) {
    patientId = param;
  } else {
    throw forbidden();
  }
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { user: { select: { id: true, name: true, timezone: true, locale: true } } },
  });
  if (!patient) throw notFound('Patient not found');
  req.patient = patient;
  next();
}

/** Short-lived token embedded into a reminder push so the service worker can confirm a dose. */
export function signDoseToken(doseId, userId) {
  return jwt.sign({ dose: doseId, sub: userId, typ: 'dose' }, config.jwtSecret, { expiresIn: '1d' });
}

export function verifyDoseToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (payload.typ !== 'dose') throw new Error('bad token');
  return payload;
}

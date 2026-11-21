import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isStaff, requireStaff, resolvePatient } from '../auth.js';
import { emitToPatient } from '../realtime.js';
import { sendPushToUser, sendPushToUsers } from '../push.js';
import { tr } from '../i18n.js';

export const patientScoped = Router({ mergeParams: true });
export const flat = Router();

const senderSelect = { select: { id: true, name: true, role: true } };

patientScoped.get('/messages', resolvePatient, async (req, res) => {
  const take = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before ? new Date(req.query.before) : null;
  const rows = await prisma.message.findMany({
    where: { patientId: req.patient.id, ...(before && !isNaN(before) ? { createdAt: { lt: before } } : {}) },
    include: { sender: senderSelect },
    orderBy: { createdAt: 'desc' },
    take,
  });
  res.json({ messages: rows.reverse(), hasMore: rows.length === take });
});

patientScoped.post('/messages', resolvePatient, async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
  const message = await prisma.message.create({
    data: { patientId: req.patient.id, senderId: req.user.id, body },
    include: { sender: senderSelect },
  });
  emitToPatient(req.patient.id, 'message:new', message);

  const snippet = body.length > 120 ? `${body.slice(0, 117)}…` : body;
  if (isStaff(req.user)) {
    const patientUser = await prisma.user.findUnique({ where: { id: req.patient.userId } });
    sendPushToUser(patientUser.id, {
      title: tr(patientUser.locale).newMessage(req.user.name),
      body: snippet,
      url: '/chat',
      tag: `chat-${req.patient.id}`,
    }).catch(() => {});
  } else {
    const staffUsers = req.patient.pharmacistId
      ? await prisma.user.findMany({ where: { id: req.patient.pharmacistId, active: true }, select: { id: true, locale: true } })
      : await prisma.user.findMany({ where: { role: { in: ['PHARMACIST', 'ADMIN'] }, active: true }, select: { id: true, locale: true } });
    await Promise.all(
      staffUsers.map((su) =>
        sendPushToUser(su.id, {
          title: tr(su.locale).newMessage(req.user.name),
          body: snippet,
          url: `/staff/patients/${req.patient.id}?tab=chat`,
          tag: `chat-${req.patient.id}`,
        }).catch(() => {}),
      ),
    );
  }
  res.status(201).json({ message });
});

/** Marks all messages written by the other side as read. */
patientScoped.post('/messages/read', resolvePatient, async (req, res) => {
  const where = { patientId: req.patient.id, readAt: null };
  if (isStaff(req.user)) where.senderId = req.patient.userId;
  else where.senderId = { not: req.user.id };
  const { count } = await prisma.message.updateMany({ where, data: { readAt: new Date() } });
  if (count) emitToPatient(req.patient.id, 'message:read', { patientId: req.patient.id, by: isStaff(req.user) ? 'staff' : 'patient' });
  res.json({ count });
});

patientScoped.get('/messages/unread', resolvePatient, async (req, res) => {
  const where = { patientId: req.patient.id, readAt: null };
  if (isStaff(req.user)) where.senderId = req.patient.userId;
  else where.senderId = { not: req.user.id };
  res.json({ count: await prisma.message.count({ where }) });
});

/** Staff inbox: conversations ordered by last activity. */
flat.get('/conversations', requireStaff, async (req, res) => {
  const last = await prisma.message.groupBy({
    by: ['patientId'],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 200,
  });
  const ids = last.map((l) => l.patientId);
  const patients = await prisma.patient.findMany({
    where: { id: { in: ids } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  const byId = Object.fromEntries(patients.map((p) => [p.id, p]));
  const lastMsgs = await Promise.all(
    ids.map((id) => prisma.message.findFirst({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, include: { sender: senderSelect } })),
  );
  const unread = await prisma.message.groupBy({
    by: ['patientId'],
    where: { patientId: { in: ids }, readAt: null, senderId: { in: patients.map((p) => p.userId) } },
    _count: { _all: true },
  });
  const unreadMap = Object.fromEntries(unread.map((u) => [u.patientId, u._count._all]));
  res.json({
    conversations: ids
      .filter((id) => byId[id])
      .map((id) => ({
        patientId: id,
        patient: { id, studyCode: byId[id].studyCode, user: byId[id].user, pharmacistId: byId[id].pharmacistId },
        lastMessage: lastMsgs[ids.indexOf(id)],
        unread: unreadMap[id] || 0,
      })),
  });
});

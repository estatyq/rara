import { prisma } from './db.js';
import { config } from './config.js';
import { materializeAll } from './doses.js';
import { sendPushToUser } from './push.js';
import { emitToUser } from './realtime.js';
import { signDoseToken } from './auth.js';
import { tr } from './i18n.js';
import { sendWhatsAppMessage, getSystemConfigMap } from './whatsapp.js';
import { formatLocal } from './time.js';

const REMIND_WINDOW_MIN = 30;
let ticking = false;

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = new Date();
    const sysCfg = await getSystemConfigMap().catch(() => ({}));
    const due = await prisma.doseLog.findMany({
      where: {
        status: 'PENDING',
        remindedAt: null,
        scheduledAt: { lte: now, gte: new Date(+now - REMIND_WINDOW_MIN * 60000) },
        medication: { active: true },
      },
      include: { medication: true, patient: { include: { user: true } } },
      take: 500,
    });

    for (const dose of due) {
      const claimed = await prisma.doseLog.updateMany({
        where: { id: dose.id, remindedAt: null },
        data: { remindedAt: now },
      });
      if (!claimed.count) continue;
      const user = dose.patient.user;
      if (!user.active) continue;
      const t = tr(user.locale);
      const payload = {
        title: t.doseTitle,
        body: t.doseBody(dose.medication.name, dose.medication.dosage),
        url: '/',
        tag: `dose-${dose.id}`,
        requireInteraction: true,
        actions: [
          { action: 'taken', title: t.actionTaken },
          { action: 'open', title: t.actionOpen },
        ],
        data: { doseId: dose.id, doseToken: signDoseToken(dose.id, user.id) },
      };
      emitToUser(user.id, 'dose:due', {
        doseId: dose.id,
        medication: dose.medication.name,
        dosage: dose.medication.dosage,
        instructions: dose.medication.instructions,
      });
      sendPushToUser(user.id, payload).catch((e) => console.warn('[scheduler] push error', e.message));

      if (user.phone && user.whatsappOptIn && sysCfg.whatsapp_auto_dose_reminder !== 'false') {
        sendWhatsAppMessage({
          phone: user.phone,
          message: t.waDoseReminder({
            name: user.name,
            medName: dose.medication.name,
            dosage: dose.medication.dosage,
            instructions: dose.medication.instructions,
          }),
          category: 'DOSE_REMINDER',
          userId: user.id,
          patientId: dose.patientId,
        }).catch((e) => console.warn('[scheduler] whatsapp error', e.message));
      }
    }

    // Check-up / Follow-up Reminders due within next 24h
    const checkupsDue = await prisma.checkupReminder.findMany({
      where: {
        status: 'UPCOMING',
        remindedAt: null,
        scheduledAt: { gte: now, lte: new Date(+now + 24 * 3600000) },
      },
      include: { patient: { include: { user: true } } },
      take: 200,
    });

    for (const c of checkupsDue) {
      const claimed = await prisma.checkupReminder.updateMany({
        where: { id: c.id, remindedAt: null },
        data: { remindedAt: now },
      });
      if (!claimed.count) continue;
      const user = c.patient.user;
      if (!user.active) continue;
      const ct = tr(user.locale);
      const whenStr = formatLocal(c.scheduledAt, user.timezone, 'dd MMM yyyy HH:mm');
      emitToUser(user.id, 'checkup:due', {
        id: c.id,
        title: c.title,
        scheduledAt: c.scheduledAt,
        location: c.location,
      });
      sendPushToUser(user.id, {
        title: ct.checkupTitle,
        body: ct.checkupBody(c.title, whenStr),
        url: '/blood-pressure?tab=checkups',
        tag: `checkup-${c.id}`,
      }).catch(() => {});
      if (user.phone && user.whatsappOptIn) {
        sendWhatsAppMessage({
          phone: user.phone,
          message: ct.waCheckupReminder({
            name: user.name,
            title: c.title,
            when: whenStr,
            location: c.location,
          }),
          category: 'FOLLOW_UP',
          userId: user.id,
          patientId: c.patientId,
        }).catch(() => {});
      }
    }

    await prisma.doseLog.updateMany({
      where: { status: 'PENDING', scheduledAt: { lt: new Date(+now - config.missedAfterHours * 3600000) } },
      data: { status: 'MISSED' },
    });
  } catch (e) {
    console.error('[scheduler] tick failed', e);
  } finally {
    ticking = false;
  }
}

async function materialize() {
  try {
    const n = await materializeAll();
    if (n) console.log(`[scheduler] materialized ${n} doses`);
  } catch (e) {
    console.error('[scheduler] materialize failed', e);
  }
}

export function startScheduler() {
  materialize().then(tick);
  setInterval(materialize, 30 * 60 * 1000);
  setInterval(tick, 60 * 1000);
}

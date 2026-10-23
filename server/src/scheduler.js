import { prisma } from './db.js';
import { config } from './config.js';
import { materializeAll } from './doses.js';
import { sendPushToUser } from './push.js';
import { emitToUser } from './realtime.js';
import { signDoseToken } from './auth.js';
import { tr } from './i18n.js';

const REMIND_WINDOW_MIN = 30;
let ticking = false;

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const now = new Date();
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
      emitToUser(user.id, 'dose:due', { doseId: dose.id, medication: dose.medication.name });
      sendPushToUser(user.id, payload).catch((e) => console.warn('[scheduler] push error', e.message));
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

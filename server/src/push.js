import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { config } from './config.js';
import { prisma } from './db.js';

let keys = null;

export function initPush() {
  if (config.vapid.publicKey && config.vapid.privateKey) {
    keys = { publicKey: config.vapid.publicKey, privateKey: config.vapid.privateKey };
  } else {
    try {
      keys = JSON.parse(fs.readFileSync(config.vapid.file, 'utf8'));
    } catch {
      keys = webpush.generateVAPIDKeys();
      try {
        if (typeof config.vapid.file === 'string') {
          fs.mkdirSync(path.dirname(config.vapid.file), { recursive: true });
        }
        fs.writeFileSync(config.vapid.file, JSON.stringify(keys, null, 2));
      } catch (e) {
        console.warn('[push] could not persist generated VAPID keys:', e.message);
      }
      console.warn('[push] VAPID keys were not configured; generated new keys. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in production.');
    }
  }
  webpush.setVapidDetails(config.vapid.subject, keys.publicKey, keys.privateKey);
}

export const vapidPublicKey = () => keys?.publicKey;

/**
 * Sends a notification to every registered device of the user.
 * payload: { title, body, url, tag, actions?, data? }
 */
export async function sendPushToUser(userId, payload) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' },
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.warn('[push] send failed', err.statusCode, err.body || err.message);
        }
      }
    }),
  );
  return subs.length;
}

export async function sendPushToUsers(userIds, payload) {
  await Promise.all([...new Set(userIds)].map((id) => sendPushToUser(id, payload)));
}

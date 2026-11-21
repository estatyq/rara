import { prisma } from './db.js';
import { emitToUser } from './realtime.js';

const DEFAULT_WA_CONFIG = {
  whatsapp_enabled: 'true',
  whatsapp_provider: 'SIMULATOR', // SIMULATOR | FONNTE | WABLAS | CLOUD_API
  whatsapp_api_url: 'https://api.fonnte.com/send',
  whatsapp_api_token: '',
  whatsapp_sender_number: '+628110000999',
  whatsapp_auto_dose_reminder: 'true',
  whatsapp_auto_bp_alert: 'true',
};

export async function getSystemConfigMap() {
  const rows = await prisma.systemConfig.findMany();
  const map = { ...DEFAULT_WA_CONFIG };
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function formatWaMeUrl(phone, text = '') {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/**
 * Sends a WhatsApp message via configured provider (Fonnte / Wablas / Meta Cloud API)
 * or logs it in Simulator mode so reminders and clinical follow-ups work out-of-the-box.
 */
export async function sendWhatsAppMessage({
  phone,
  message,
  category = 'DOSE_REMINDER',
  userId = null,
  patientId = null,
}) {
  if (!phone || !message) return null;
  const cfg = await getSystemConfigMap();
  if (cfg.whatsapp_enabled === 'false') return null;

  const provider = cfg.whatsapp_provider || 'SIMULATOR';
  let status = 'DELIVERED';
  let externalId = `wa-sim-${Date.now()}`;

  if (provider !== 'SIMULATOR' && cfg.whatsapp_api_token && cfg.whatsapp_api_url) {
    try {
      const res = await fetch(cfg.whatsapp_api_url, {
        method: 'POST',
        headers: {
          Authorization: cfg.whatsapp_api_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: phone,
          phone,
          message,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        status = 'SENT';
        externalId = String(data.id || data.message_id || externalId);
      } else {
        status = 'FAILED';
      }
    } catch (err) {
      console.warn('[whatsapp] external gateway error:', err.message);
      status = 'FAILED';
    }
  }

  const log = await prisma.whatsAppLog.create({
    data: {
      userId,
      patientId,
      phone,
      direction: 'OUTBOUND',
      category,
      message,
      status,
      provider,
      externalId,
    },
  });

  if (userId) {
    emitToUser(userId, 'whatsapp:message', log);
  }
  return log;
}

import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';
const DEV_SECRET = 'dev-secret-change-me';

export const config = {
  isProd,
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || DEV_SECRET,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:ops@doselynx.com',
    file: process.env.VAPID_FILE || new URL('../.vapid.json', import.meta.url),
  },
  missedAfterHours: Number(process.env.MISSED_AFTER_HOURS || 3),
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Jakarta',
};

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong random value in production');
}

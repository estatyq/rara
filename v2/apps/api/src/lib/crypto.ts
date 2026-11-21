import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config.js';

const ENC_KEY = Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex');

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomOtp6(): string {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * AES-256-GCM authenticated encryption for storing third-party API tokens & TOTP secrets at rest.
 */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [ivStr, tagStr, dataStr] = payload.split('.');
  if (!ivStr || !tagStr || !dataStr) throw new Error('Corrupted encrypted secret payload');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(ivStr, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagStr, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataStr, 'base64url')), decipher.final()]).toString('utf8');
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  role: string;
  tid?: string | null;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded !== 'object' || !decoded || !('sub' in decoded) || !('sid' in decoded)) {
    throw new Error('Malformed token');
  }
  return decoded as AccessTokenClaims;
}

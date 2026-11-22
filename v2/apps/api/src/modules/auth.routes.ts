import { prisma } from '@dosemate/db';
import {
  ErrorCode,
  LoginSchema,
  normalizeInternationalPhone,
  RegisterSchema,
  SupportedLocaleSchema,
} from '@dosemate/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { CountryCode } from 'libphonenumber-js';
import { z } from 'zod';
import { env } from '../config.js';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate } from '../lib/auth.js';
import { hashPassword, randomOtp6, randomToken, sha256, signAccessToken, verifyPassword } from '../lib/crypto.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { revokeUserSockets } from '../lib/realtime.js';

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const base = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
  };
  reply.setCookie('dm_access', accessToken, { ...base, maxAge: 15 * 60 });
  reply.setCookie('dm_refresh', refreshToken, { ...base, maxAge: 30 * 24 * 3600 });
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('dm_access', { path: '/' });
  reply.clearCookie('dm_refresh', { path: '/' });
}

async function issueSession(
  user: { id: string; globalRole: string; name: string },
  tenantId: string | null,
  transport: 'cookie' | 'bearer',
  meta: { ip?: string; ua?: string },
) {
  const refreshToken = randomToken(40);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: sha256(refreshToken),
      transport: transport.toUpperCase(),
      ipAddress: meta.ip ?? null,
      userAgent: meta.ua ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  const accessToken = signAccessToken({
    sub: user.id,
    sid: session.id,
    role: user.globalRole,
    tid: tenantId,
  });
  return { session, accessToken, refreshToken };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const data = RegisterSchema.parse(req.body);
    const normalizedPhone = data.phone
      ? normalizeInternationalPhone(data.phone, data.countryCode as CountryCode)
      : null;
    if (data.phone && !normalizedPhone) {
      throw badRequest(ErrorCode.VALIDATION_ERROR, 'Invalid international phone number');
    }

    // Optional Pharmacy QR Invite Code lookup
    const invitedTenant = data.inviteCode
      ? await prisma.tenant.findFirst({ where: { inviteCode: data.inviteCode, active: true } })
      : null;

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email ?? null,
        phone: normalizedPhone,
        passwordHash,
        globalRole: 'PATIENT',
        locale: data.locale,
        timezone: data.timezone,
        countryCode: data.countryCode,
        privacyMode: true,
        consents: {
          create: {
            tenantId: invitedTenant?.id ?? null,
            consentType: 'CLINICAL_AND_PRIVACY',
            version: data.consentVersion,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
        },
        patientProfile: {
          create: {
            ...(invitedTenant
              ? {
                  enrollments: {
                    create: {
                      tenantId: invitedTenant.id,
                      status: 'ACTIVE',
                    },
                  },
                }
              : {}),
          },
        },
      },
      include: { patientProfile: { select: { id: true } } },
    });

    const { accessToken, refreshToken } = await issueSession(user, invitedTenant?.id ?? null, 'cookie', {
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    setAuthCookies(reply, accessToken, refreshToken);

    await writeAuditLog({
      tenantId: invitedTenant?.id ?? null,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.globalRole,
      action: 'AUTH_REGISTER',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    return reply.status(201).send({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        globalRole: user.globalRole,
        locale: user.locale,
        timezone: user.timezone,
        privacyMode: user.privacyMode,
        patientProfileId: user.patientProfile?.id ?? null,
        activeTenantId: invitedTenant?.id ?? null,
      },
    });
  });

  app.post('/login', async (req, reply) => {
    const data = LoginSchema.parse(req.body);
    const isEmail = data.login.includes('@');
    const lookupPhone = !isEmail
      ? normalizeInternationalPhone(data.login, data.countryCode as CountryCode)
      : null;

    const user = await prisma.user.findUnique({
      where: isEmail ? { email: data.login.toLowerCase() } : { phone: lookupPhone ?? data.login },
      include: {
        patientProfile: {
          include: {
            enrollments: { where: { status: 'ACTIVE' }, take: 1, include: { tenant: true } },
          },
        },
        staffMemberships: {
          where: { active: true, revokedAt: null },
          include: { tenant: true },
        },
        pharmacistCredentials: {
          where: { verificationStatus: 'VERIFIED' },
          select: { id: true, licenseType: true, licenseNumber: true },
        },
      },
    });

    if (!user || !user.active || user.deletedAt || !(await verifyPassword(user.passwordHash, data.password))) {
      throw unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid email/phone or password');
    }

    const defaultTenantId =
      user.staffMemberships[0]?.tenantId ??
      user.patientProfile?.enrollments[0]?.tenantId ??
      null;

    const { accessToken, refreshToken } = await issueSession(user, defaultTenantId, data.transport, {
      ip: req.ip,
      ua: req.headers['user-agent'],
    });

    if (data.transport === 'cookie') {
      setAuthCookies(reply, accessToken, refreshToken);
    }

    await writeAuditLog({
      tenantId: defaultTenantId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.globalRole,
      action: 'AUTH_LOGIN',
      entityType: 'Session',
      ipAddress: req.ip,
      details: { transport: data.transport },
    });

    return reply.send({
      accessToken,
      ...(data.transport === 'bearer' ? { refreshToken } : {}),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        globalRole: user.globalRole,
        locale: user.locale,
        timezone: user.timezone,
        privacyMode: user.privacyMode,
        whatsappOptIn: user.whatsappOptIn,
        patientProfileId: user.patientProfile?.id ?? null,
        activeTenantId: defaultTenantId,
        tenants: user.staffMemberships.map((m) => ({
          id: m.tenant.id,
          name: m.tenant.name,
          slug: m.tenant.slug,
          role: m.role,
          inviteCode: m.tenant.inviteCode,
          currency: m.tenant.defaultCurrency,
        })),
        verifiedCredentials: user.pharmacistCredentials,
      },
    });
  });

  app.post('/refresh', async (req, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(req.body ?? {});
    const rawRefresh = body.refreshToken || req.cookies?.dm_refresh;
    if (!rawRefresh) throw unauthorized(ErrorCode.AUTH_TOKEN_EXPIRED, 'Missing refresh token');

    const tokenHash = sha256(rawRefresh);
    const existing = await prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: {
            staffMemberships: { where: { active: true, revokedAt: null }, take: 1 },
            patientProfile: { include: { enrollments: { where: { status: 'ACTIVE' }, take: 1 } } },
          },
        },
      },
    });

    if (!existing || existing.revokedAt || existing.expiresAt < new Date() || !existing.user.active) {
      clearAuthCookies(reply);
      throw unauthorized(ErrorCode.AUTH_TOKEN_REVOKED, 'Refresh session invalid or revoked');
    }

    // Rotate refresh token (invalidate old session, issue fresh one)
    const nextRefresh = randomToken(40);
    const nextTenantId =
      existing.user.staffMemberships[0]?.tenantId ??
      existing.user.patientProfile?.enrollments[0]?.tenantId ??
      null;

    await prisma.$transaction([
      prisma.session.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
    ]);

    const nextSession = await prisma.session.create({
      data: {
        userId: existing.userId,
        refreshTokenHash: sha256(nextRefresh),
        transport: existing.transport,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    const accessToken = signAccessToken({
      sub: existing.user.id,
      sid: nextSession.id,
      role: existing.user.globalRole,
      tid: nextTenantId,
    });

    if (existing.transport === 'COOKIE') {
      setAuthCookies(reply, accessToken, nextRefresh);
    }

    return reply.send({
      accessToken,
      ...(existing.transport === 'BEARER' ? { refreshToken: nextRefresh } : {}),
    });
  });

  app.post('/logout', { preHandler: [authenticate] }, async (req, reply) => {
    await prisma.session.update({
      where: { id: req.auth.sessionId },
      data: { revokedAt: new Date() },
    });
    clearAuthCookies(reply);
    revokeUserSockets(req.auth.userId);
    return reply.send({ ok: true });
  });

  app.get('/me', { preHandler: [authenticate] }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth.userId },
      include: {
        patientProfile: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              include: {
                tenant: { select: { id: true, name: true, slug: true, inviteCode: true, defaultCurrency: true } },
                pharmacist: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
        staffMemberships: {
          where: { active: true, revokedAt: null },
          include: { tenant: { select: { id: true, name: true, slug: true, inviteCode: true, defaultCurrency: true } } },
        },
        pharmacistCredentials: {
          select: { id: true, countryCode: true, licenseType: true, licenseNumber: true, verificationStatus: true },
        },
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        globalRole: user.globalRole,
        locale: user.locale,
        timezone: user.timezone,
        countryCode: user.countryCode,
        privacyMode: user.privacyMode,
        whatsappOptIn: user.whatsappOptIn,
        patientProfileId: user.patientProfile?.id ?? null,
        estimatedDueDate: user.patientProfile?.estimatedDueDate ?? null,
        enrollments: user.patientProfile?.enrollments ?? [],
        activeTenantId: req.auth.activeTenantId,
        tenants: user.staffMemberships.map((m) => ({
          ...m.tenant,
          role: m.role,
        })),
        credentials: user.pharmacistCredentials,
      },
    };
  });

  app.patch('/me', { preHandler: [authenticate] }, async (req) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      locale: SupportedLocaleSchema.optional(),
      timezone: z.string().min(2).max(64).optional(),
      privacyMode: z.boolean().optional(),
      whatsappOptIn: z.boolean().optional(),
    });
    const d = schema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.auth.userId },
      data: d,
      select: {
        id: true,
        name: true,
        locale: true,
        timezone: true,
        privacyMode: true,
        whatsappOptIn: true,
      },
    });
    return { user: updated };
  });

  /**
   * App Store Guideline 5.1.1 & UU PDP No. 27/2022 compliant self-service account deletion/anonymization.
   * Preserves anonymized clinical rows for statutory retention (PMK RME) while wiping PII and revoking sessions.
   */
  app.delete('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const anonSuffix = req.auth.userId.slice(-6);
    await prisma.$transaction([
      prisma.session.updateMany({ where: { userId: req.auth.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.user.update({
        where: { id: req.auth.userId },
        data: {
          name: `Anonymized User ${anonSuffix}`,
          email: null,
          phone: null,
          active: false,
          deletedAt: new Date(),
        },
      }),
    ]);
    clearAuthCookies(reply);
    revokeUserSockets(req.auth.userId);
    await writeAuditLog({
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.globalRole,
      action: 'ACCOUNT_ANONYMIZED_SELF',
      entityType: 'User',
      entityId: req.auth.userId,
      ipAddress: req.ip,
    });
    return reply.send({ ok: true });
  });

  // WhatsApp / Email OTP verification flow
  app.post('/otp/request', async (req) => {
    const data = z.object({
      channel: z.enum(['WHATSAPP', 'EMAIL']).default('WHATSAPP'),
      target: z.string().trim().min(5).max(120),
      purpose: z.enum(['PHONE_VERIFY', 'PASSWORD_RESET']).default('PHONE_VERIFY'),
      countryCode: z.string().length(2).default('ID'),
    }).parse(req.body);

    const normalizedTarget =
      data.channel === 'WHATSAPP'
        ? normalizeInternationalPhone(data.target, data.countryCode as CountryCode) ?? data.target
        : data.target.toLowerCase();

    const code = randomOtp6();
    await prisma.otpChallenge.create({
      data: {
        channel: data.channel,
        target: normalizedTarget,
        codeHash: sha256(code),
        purpose: data.purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await prisma.notificationLog.create({
      data: {
        channel: data.channel,
        category: 'OTP',
        templateName: 'otp_verify_v1',
        recipient: normalizedTarget,
        payloadPreview: 'DoseLynx verification code dispatched (redacted)',
        status: 'DELIVERED',
        provider: 'SIMULATOR',
      },
    });

    return {
      ok: true,
      expiresInSeconds: 600,
      ...(env.NODE_ENV !== 'production' ? { devOtpPreview: code } : {}),
    };
  });

  app.post('/otp/verify', { preHandler: [authenticate] }, async (req) => {
    const data = z.object({
      target: z.string().trim().min(5),
      code: z.string().length(6),
      purpose: z.enum(['PHONE_VERIFY', 'PASSWORD_RESET']).default('PHONE_VERIFY'),
    }).parse(req.body);

    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        target: data.target,
        purpose: data.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || challenge.attempts >= 5 || challenge.codeHash !== sha256(data.code)) {
      if (challenge) {
        await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      }
      throw badRequest(ErrorCode.AUTH_OTP_INVALID, 'Invalid or expired verification code');
    }

    await prisma.$transaction([
      prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
      prisma.user.update({
        where: { id: req.auth.userId },
        data: challenge.channel === 'WHATSAPP' ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() },
      }),
    ]);

    return { ok: true, verified: true };
  });
}

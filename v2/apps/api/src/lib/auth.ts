import { prisma, withTenant } from '@dosemate/db';
import { ErrorCode } from '@dosemate/shared';
import type { FastifyRequest } from 'fastify';
import { verifyAccessToken } from './crypto.js';
import { forbidden, notFound, unauthorized } from './errors.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
  globalRole: string;
  name: string;
  email: string | null;
  phone: string | null;
  locale: 'id' | 'en';
  timezone: string;
  privacyMode: boolean;
  patientProfileId: string | null;
  activeTenantId: string | null;
  tenantRole: string | null;
  isVerifiedPharmacist: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export function extractAccessToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = req.cookies?.dm_access;
  if (cookieToken) return cookieToken;
  return null;
}

export async function authenticate(req: FastifyRequest): Promise<void> {
  const token = extractAccessToken(req);
  if (!token) throw unauthorized();

  let claims;
  try {
    claims = verifyAccessToken(token);
  } catch {
    throw unauthorized(ErrorCode.AUTH_TOKEN_EXPIRED, 'Access token invalid or expired');
  }

  const session = await prisma.session.findUnique({
    where: { id: claims.sid },
    include: {
      user: {
        include: {
          patientProfile: { select: { id: true } },
          staffMemberships: {
            where: { active: true, revokedAt: null },
            include: { tenant: { select: { id: true, active: true } } },
          },
          pharmacistCredentials: {
            where: { verificationStatus: 'VERIFIED' },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw unauthorized(ErrorCode.AUTH_TOKEN_REVOKED, 'Session revoked or expired');
  }

  const user = session.user;
  if (!user.active || user.deletedAt) {
    throw unauthorized(ErrorCode.AUTH_ACCOUNT_INACTIVE, 'Account inactive');
  }

  const requestedTenantHeader = req.headers['x-tenant-id'];
  const requestedTenantId =
    typeof requestedTenantHeader === 'string' && requestedTenantHeader.trim()
      ? requestedTenantHeader.trim()
      : claims.tid ?? null;

  const activeMemberships = user.staffMemberships.filter((m) => m.tenant.active);
  const matchedMembership = requestedTenantId
    ? activeMemberships.find((m) => m.tenantId === requestedTenantId)
    : activeMemberships[0];

  // If a staff user explicitly sends X-Tenant-Id for a pharmacy they don't belong to, deny immediately!
  if (
    requestedTenantHeader &&
    typeof requestedTenantHeader === 'string' &&
    user.globalRole !== 'SUPER_ADMIN' &&
    !matchedMembership &&
    user.globalRole !== 'PATIENT'
  ) {
    throw forbidden(ErrorCode.TENANT_ACCESS_DENIED, 'You do not belong to the requested pharmacy tenant');
  }

  req.auth = {
    userId: user.id,
    sessionId: session.id,
    globalRole: user.globalRole,
    name: user.name,
    email: user.email,
    phone: user.phone,
    locale: user.locale === 'en' ? 'en' : 'id',
    timezone: user.timezone,
    privacyMode: user.privacyMode,
    patientProfileId: user.patientProfile?.id ?? null,
    activeTenantId: matchedMembership?.tenantId ?? (user.globalRole === 'SUPER_ADMIN' ? requestedTenantId : null),
    tenantRole: matchedMembership?.role ?? (user.globalRole === 'SUPER_ADMIN' ? 'OWNER' : null),
    isVerifiedPharmacist: user.pharmacistCredentials.length > 0 || user.globalRole === 'SUPER_ADMIN',
  };
}

export async function requireTenantStaff(req: FastifyRequest): Promise<void> {
  await authenticate(req);
  if (!req.auth.activeTenantId || !req.auth.tenantRole) {
    throw forbidden(ErrorCode.TENANT_ACCESS_DENIED, 'Pharmacy staff membership required');
  }
}

export async function requireVerifiedPharmacist(req: FastifyRequest): Promise<void> {
  await requireTenantStaff(req);
  if (!req.auth.isVerifiedPharmacist) {
    throw forbidden(ErrorCode.PHARMACIST_NOT_VERIFIED, 'Verified pharmacist credential required');
  }
}

export interface ResolvedPatientContext {
  patientId: string;
  userId: string;
  name: string;
  locale: 'id' | 'en';
  timezone: string;
  privacyMode: boolean;
  tenantId: string | null;
  enrollmentId: string | null;
  pharmacistId: string | null;
  studyCode: string | null;
}

/**
 * Resolves `:patientId` ("me" or a patientProfileId) with STRICT multi-tenant isolation:
 * - Patients may only access themselves (or active Caregivers linked to them).
 * - Staff may ONLY access patients who have an ACTIVE CareEnrollment inside `req.auth.activeTenantId`
 *   (checked via `withTenant` with PostgreSQL Row-Level Security!).
 */
export async function resolvePatientAccess(
  req: FastifyRequest,
  patientParam: string,
): Promise<ResolvedPatientContext> {
  if (patientParam === 'me') {
    if (!req.auth.patientProfileId) {
      throw forbidden(ErrorCode.FORBIDDEN, 'Patient profile required');
    }
    const profile = await prisma.patientProfile.findUnique({
      where: { id: req.auth.patientProfileId },
      include: {
        user: { select: { id: true, name: true, locale: true, timezone: true, privacyMode: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          orderBy: { enrolledAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!profile) throw notFound('Patient not found');
    const activeEnrollment = profile.enrollments[0] ?? null;
    return {
      patientId: profile.id,
      userId: profile.user.id,
      name: profile.user.name,
      locale: profile.user.locale === 'en' ? 'en' : 'id',
      timezone: profile.user.timezone,
      privacyMode: profile.user.privacyMode,
      tenantId: activeEnrollment?.tenantId ?? null,
      enrollmentId: activeEnrollment?.id ?? null,
      pharmacistId: activeEnrollment?.pharmacistId ?? null,
      studyCode: activeEnrollment?.studyCode ?? null,
    };
  }

  // Self access by explicit id
  if (req.auth.patientProfileId === patientParam) {
    return resolvePatientAccess(req, 'me');
  }

  // Caregiver read-only access
  const caregiver = await prisma.caregiverLink.findFirst({
    where: {
      patientId: patientParam,
      caregiverUserId: req.auth.userId,
      status: 'ACTIVE',
      canViewAdherence: true,
    },
    include: {
      patient: {
        include: { user: { select: { id: true, name: true, locale: true, timezone: true, privacyMode: true } } },
      },
    },
  });
  if (caregiver) {
    return {
      patientId: caregiver.patient.id,
      userId: caregiver.patient.user.id,
      name: caregiver.patient.user.name,
      locale: caregiver.patient.user.locale === 'en' ? 'en' : 'id',
      timezone: caregiver.patient.user.timezone,
      privacyMode: caregiver.patient.user.privacyMode,
      tenantId: null,
      enrollmentId: null,
      pharmacistId: null,
      studyCode: null,
    };
  }

  // Staff access MUST pass PostgreSQL RLS inside `withTenant`
  if (!req.auth.activeTenantId || !req.auth.tenantRole) {
    throw forbidden(ErrorCode.TENANT_ACCESS_DENIED, 'Access denied');
  }

  const enrollment = await withTenant(req.auth.activeTenantId, (tx) =>
    tx.careEnrollment.findFirst({
      where: {
        patientId: patientParam,
        tenantId: req.auth.activeTenantId!,
        status: 'ACTIVE',
      },
      include: {
        patient: {
          include: {
            user: { select: { id: true, name: true, locale: true, timezone: true, privacyMode: true } },
          },
        },
      },
    }),
  );

  if (!enrollment) {
    throw forbidden(ErrorCode.TENANT_ACCESS_DENIED, 'Patient is not enrolled in your pharmacy tenant');
  }

  return {
    patientId: enrollment.patient.id,
    userId: enrollment.patient.user.id,
    name: enrollment.patient.user.name,
    locale: enrollment.patient.user.locale === 'en' ? 'en' : 'id',
    timezone: enrollment.patient.user.timezone,
    privacyMode: enrollment.patient.user.privacyMode,
    tenantId: enrollment.tenantId,
    enrollmentId: enrollment.id,
    pharmacistId: enrollment.pharmacistId,
    studyCode: enrollment.studyCode,
  };
}

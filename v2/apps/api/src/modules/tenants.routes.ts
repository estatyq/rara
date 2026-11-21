import { prisma } from '@dosemate/db';
import { ErrorCode } from '@dosemate/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { authenticate, requireTenantStaff } from '../lib/auth.js';
import { encryptSecret } from '../lib/crypto.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';

export async function tenantRoutes(app: FastifyInstance) {
  app.get('/current', { preHandler: [requireTenantStaff] }, async (req) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth.activeTenantId! },
      include: {
        branches: true,
        quota: true,
        integrationConfig: true,
      },
    });
    if (!tenant) throw notFound('Pharmacy tenant not found');

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        countryCode: tenant.countryCode,
        defaultCurrency: tenant.defaultCurrency,
        defaultLocale: tenant.defaultLocale,
        inviteCode: tenant.inviteCode,
        brandPrimaryHex: tenant.brandPrimaryHex,
        branches: tenant.branches,
        quota: tenant.quota,
        integration: tenant.integrationConfig
          ? {
              whatsappEnabled: tenant.integrationConfig.whatsappEnabled,
              whatsappProvider: tenant.integrationConfig.whatsappProvider,
              whatsappApiUrl: tenant.integrationConfig.whatsappApiUrl,
              whatsappSenderId: tenant.integrationConfig.whatsappSenderId,
              autoDoseEscalation: tenant.integrationConfig.autoDoseEscalation,
              autoBpAlert: tenant.integrationConfig.autoBpAlert,
              apiTokenConfigured: Boolean(tenant.integrationConfig.encryptedApiToken),
            }
          : null,
      },
    };
  });

  /**
   * B2B2C QR-code pharmacy onboarding: patient scans pharmacy QR invite code to enroll!
   */
  app.post('/join-by-invite', { preHandler: [authenticate] }, async (req, reply) => {
    if (!req.auth.patientProfileId) {
      throw forbidden(ErrorCode.FORBIDDEN, 'Only patient accounts can enroll via pharmacy QR invite');
    }
    const { inviteCode } = z.object({ inviteCode: z.string().trim().min(4).max(40) }).parse(req.body);

    const tenant = await prisma.tenant.findFirst({
      where: { inviteCode, active: true },
      include: {
        quota: true,
        staffMemberships: { where: { active: true, revokedAt: null }, take: 1 },
      },
    });
    if (!tenant) throw notFound('Invalid or inactive pharmacy invite code');

    // Enforce TenantQuota limit
    if (tenant.quota) {
      const currentCount = await prisma.careEnrollment.count({
        where: { tenantId: tenant.id, status: 'ACTIVE' },
      });
      if (currentCount >= tenant.quota.maxPatients) {
        throw badRequest(ErrorCode.QUOTA_EXCEEDED, 'Pharmacy patient enrollment limit reached');
      }
    }

    const enrollment = await prisma.careEnrollment.upsert({
      where: {
        patientId_tenantId: {
          patientId: req.auth.patientProfileId,
          tenantId: tenant.id,
        },
      },
      update: { status: 'ACTIVE', revokedAt: null },
      create: {
        patientId: req.auth.patientProfileId,
        tenantId: tenant.id,
        pharmacistId: tenant.staffMemberships[0]?.userId ?? null,
        status: 'ACTIVE',
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, inviteCode: true } },
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.globalRole,
      action: 'PATIENT_QR_ENROLL',
      entityType: 'CareEnrollment',
      entityId: enrollment.id,
      ipAddress: req.ip,
    });

    return reply.status(201).send({ enrollment });
  });

  app.patch('/integrations', { preHandler: [requireTenantStaff] }, async (req) => {
    if (!['OWNER', 'TENANT_ADMIN'].includes(req.auth.tenantRole ?? '')) {
      throw forbidden(ErrorCode.FORBIDDEN, 'Tenant administrator role required');
    }

    const data = z.object({
      whatsappEnabled: z.boolean().optional(),
      whatsappProvider: z.enum(['SIMULATOR', 'META_CLOUD', 'FONNTE', 'WABLAS']).optional(),
      whatsappApiUrl: z.string().url().nullable().optional(),
      whatsappApiToken: z.string().min(4).max(500).optional(),
      whatsappSenderId: z.string().max(60).nullable().optional(),
      autoDoseEscalation: z.boolean().optional(),
      autoBpAlert: z.boolean().optional(),
    }).parse(req.body);

    // Strict SSRF protection on external WhatsApp endpoint
    if (data.whatsappApiUrl) {
      const parsed = new URL(data.whatsappApiUrl);
      if (
        parsed.protocol !== 'https:' ||
        /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1)/.test(parsed.hostname)
      ) {
        throw badRequest(ErrorCode.VALIDATION_ERROR, 'External WhatsApp API URL must be a public HTTPS host');
      }
    }

    const encryptedToken = data.whatsappApiToken ? encryptSecret(data.whatsappApiToken) : undefined;

    const updated = await prisma.tenantIntegrationConfig.upsert({
      where: { tenantId: req.auth.activeTenantId! },
      create: {
        tenantId: req.auth.activeTenantId!,
        whatsappEnabled: data.whatsappEnabled ?? true,
        whatsappProvider: data.whatsappProvider ?? 'SIMULATOR',
        whatsappApiUrl: data.whatsappApiUrl ?? null,
        encryptedApiToken: encryptedToken ?? null,
        whatsappSenderId: data.whatsappSenderId ?? null,
        autoDoseEscalation: data.autoDoseEscalation ?? true,
        autoBpAlert: data.autoBpAlert ?? true,
      },
      update: {
        ...(data.whatsappEnabled !== undefined ? { whatsappEnabled: data.whatsappEnabled } : {}),
        ...(data.whatsappProvider !== undefined ? { whatsappProvider: data.whatsappProvider } : {}),
        ...(data.whatsappApiUrl !== undefined ? { whatsappApiUrl: data.whatsappApiUrl } : {}),
        ...(encryptedToken !== undefined ? { encryptedApiToken: encryptedToken } : {}),
        ...(data.whatsappSenderId !== undefined ? { whatsappSenderId: data.whatsappSenderId } : {}),
        ...(data.autoDoseEscalation !== undefined ? { autoDoseEscalation: data.autoDoseEscalation } : {}),
        ...(data.autoBpAlert !== undefined ? { autoBpAlert: data.autoBpAlert } : {}),
      },
    });

    await writeAuditLog({
      tenantId: req.auth.activeTenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.tenantRole ?? req.auth.globalRole,
      action: 'UPDATE_TENANT_INTEGRATION',
      entityType: 'TenantIntegrationConfig',
      entityId: updated.id,
      ipAddress: req.ip,
      details: { provider: updated.whatsappProvider, tokenRotated: Boolean(encryptedToken) },
    });

    return {
      integration: {
        whatsappEnabled: updated.whatsappEnabled,
        whatsappProvider: updated.whatsappProvider,
        whatsappApiUrl: updated.whatsappApiUrl,
        whatsappSenderId: updated.whatsappSenderId,
        autoDoseEscalation: updated.autoDoseEscalation,
        autoBpAlert: updated.autoBpAlert,
        apiTokenConfigured: Boolean(updated.encryptedApiToken),
      },
    };
  });
}

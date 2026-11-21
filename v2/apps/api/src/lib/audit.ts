import { type Prisma, prisma } from '@dosemate/db';

export interface AuditInput {
  tenantId?: string | null;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.warn('[audit] write failed:', err instanceof Error ? err.message : String(err));
  }
}

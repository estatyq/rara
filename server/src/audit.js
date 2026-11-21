import { prisma } from './db.js';

export async function logAudit(actor, action, entityType, entityId = null, details = null) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id || null,
        actorName: actor?.name || 'System',
        actorRole: actor?.role || 'SYSTEM',
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        details: typeof details === 'object' && details !== null ? JSON.stringify(details) : details,
      },
    });
  } catch (err) {
    console.warn('[audit] failed to write audit log:', err.message);
  }
}

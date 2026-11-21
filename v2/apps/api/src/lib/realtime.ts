import type http from 'node:http';
import { prisma } from '@dosemate/db';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config.js';
import { verifyAccessToken } from './crypto.js';

let io: SocketIOServer | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export async function initRealtime(httpServer: http.Server): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
  });

  if (env.NODE_ENV !== 'test') {
    try {
      pubClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
      subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
    } catch (err) {
      console.warn('[realtime] Valkey adapter fallback to local memory:', err instanceof Error ? err.message : err);
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') return next(new Error('unauthorized'));
      const claims = verifyAccessToken(token);
      const session = await prisma.session.findUnique({
        where: { id: claims.sid },
        include: {
          user: {
            include: {
              patientProfile: { select: { id: true } },
              staffMemberships: { where: { active: true, revokedAt: null }, select: { tenantId: true } },
            },
          },
        },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) {
        return next(new Error('unauthorized'));
      }
      socket.data.userId = session.user.id;
      socket.data.sessionId = session.id;
      socket.data.patientId = session.user.patientProfile?.id ?? null;
      socket.data.tenantIds = session.user.staffMemberships.map((m) => m.tenantId);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const patientId = socket.data.patientId as string | null;
    const tenantIds = (socket.data.tenantIds as string[]) || [];

    socket.join(`user:${userId}`);
    if (patientId) socket.join(`patient:${patientId}`);
    // Strictly tenant-isolated staff rooms (NEVER a global shared 'staff' room!)
    for (const tid of tenantIds) {
      socket.join(`tenant:${tid}:staff`);
    }
  });

  return io;
}

export function emitToTenantPatient(tenantId: string | null, patientId: string, event: string, payload: unknown): void {
  if (!io) return;
  let target = io.to(`patient:${patientId}`);
  if (tenantId) {
    target = target.to(`tenant:${tenantId}:staff`);
  }
  target.emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

/**
 * Immediately disconnects all live WebSockets for a user whose session or staff membership was revoked.
 */
export function revokeUserSockets(userId: string): void {
  io?.in(`user:${userId}`).disconnectSockets(true);
}

export async function closeRealtime(): Promise<void> {
  await io?.close();
  pubClient?.disconnect();
  subClient?.disconnect();
  io = null;
}

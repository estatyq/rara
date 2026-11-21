import { type Prisma, prisma } from '@dosemate/db';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Supports `Idempotency-Key` header (UUID v7 recommended) for offline-first mobile retries,
 * ensuring duplicate BP logs, dose confirmations, or messages are never created on flaky networks.
 */
export async function withIdempotency<T>(
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
  statusCode: number,
  handler: () => Promise<T>,
): Promise<T | void> {
  const key = req.headers['idempotency-key'];
  if (!key || typeof key !== 'string' || key.length < 8 || key.length > 128) {
    const result = await handler();
    return reply.status(statusCode).send(result);
  }

  const existing = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (existing && existing.userId === userId && existing.expiresAt > new Date()) {
    reply.header('X-Idempotent-Replay', 'true');
    return reply.status(existing.statusCode).send(existing.responseBody);
  }

  const result = await handler();
  await prisma.idempotencyRecord
    .upsert({
      where: { key },
      update: {
        statusCode,
        responseBody: result as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
      create: {
        key,
        userId,
        method: req.method,
        path: req.url,
        statusCode,
        responseBody: result as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    })
    .catch(() => {});

  return reply.status(statusCode).send(result);
}

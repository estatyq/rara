import { Queue } from 'bullmq';
import { env } from '../config.js';

export const QUEUE_NAMES = {
  ESCALATIONS: 'dosemate-critical-escalations',
  NOTIFICATIONS: 'dosemate-notifications',
} as const;

let escalationsQueue: Queue | null = null;
let notificationsQueue: Queue | null = null;

function redisConnectionOptions() {
  const parsed = new URL(env.REDIS_URL);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

export function getEscalationsQueue(): Queue | null {
  if (env.NODE_ENV === 'test') return null;
  if (!escalationsQueue) {
    escalationsQueue = new Queue(QUEUE_NAMES.ESCALATIONS, {
      connection: redisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }
  return escalationsQueue;
}

export function getNotificationsQueue(): Queue | null {
  if (env.NODE_ENV === 'test') return null;
  if (!notificationsQueue) {
    notificationsQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
      connection: redisConnectionOptions(),
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return notificationsQueue;
}

export async function enqueueCriticalBpEscalation(input: {
  bpLogId: string;
  patientId: string;
  tenantId: string | null;
}): Promise<void> {
  const q = getEscalationsQueue();
  if (!q) return;
  await q.add('bp-critical-sla', input, {
    delay: env.CRITICAL_BP_ESCALATION_MINUTES * 60 * 1000,
    jobId: `bp-sla-${input.bpLogId}`,
  });
}

export async function closeQueues(): Promise<void> {
  await Promise.all([escalationsQueue?.close(), notificationsQueue?.close()]);
  escalationsQueue = null;
  notificationsQueue = null;
}

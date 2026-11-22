import { prisma, runtimePrisma } from '@dosemate/db';
import { buildApp } from './app.js';
import { env } from './config.js';
import { closeQueues } from './lib/queues.js';
import { closeRealtime, initRealtime } from './lib/realtime.js';

async function start() {
  const app = await buildApp();
  await app.ready();
  await initRealtime(app.server);

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  app.log.info(`[doselynx-v2] API listening on http://localhost:${env.API_PORT} (OpenAPI docs: /docs)`);

  const shutdown = async () => {
    app.log.info('Gracefully shutting down DoseLynx API v2...');
    await closeRealtime();
    await closeQueues();
    await app.close();
    await Promise.all([prisma.$disconnect(), runtimePrisma.$disconnect()]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[doselynx-v2] Fatal boot error:', err);
  process.exit(1);
});

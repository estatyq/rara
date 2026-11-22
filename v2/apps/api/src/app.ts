import { prisma } from '@dosemate/db';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { Redis } from 'ioredis';
import { env } from './config.js';
import { globalErrorHandler } from './lib/errors.js';
import { authRoutes } from './modules/auth.routes.js';
import { careRoutes } from './modules/care.routes.js';
import { educationRoutes } from './modules/education.routes.js';
import { exportRoutes } from './modules/export.routes.js';
import { healthRoutes } from './modules/health.routes.js';
import { medicationRoutes } from './modules/medications.routes.js';
import { patientRoutes } from './modules/patients.routes.js';
import { tenantRoutes } from './modules/tenants.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.isProd ? 'info' : 'debug',
            // Strict PHI / Secret log redaction
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.refreshToken',
                'req.body.whatsappApiToken',
              ],
              censor: '[REDACTED]',
            },
          },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(globalErrorHandler);

  await app.register(helmet, {
    contentSecurityPolicy: env.isProd ? undefined : false,
  });

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });

  await app.register(cookie);

  if (env.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: 120,
      timeWindow: '1 minute',
    });
  }

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'DoseLynx Cloud v2 API',
        description: 'Global Multi-Tenant Digital Pharmacy & Medication Adherence Platform API',
        version: '2.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Healthcheck verifies PostgreSQL & Valkey connectivity
  app.get('/api/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    let valkey = 'skipped';
    if (env.NODE_ENV !== 'test') {
      const r = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 1500 });
      try {
        valkey = (await r.ping()) === 'PONG' ? 'ok' : 'degraded';
      } catch {
        valkey = 'unreachable';
      } finally {
        r.disconnect();
      }
    }
    return { ok: true, service: 'doselynx-api-v2', valkey, time: new Date().toISOString() };
  });

  // Register modular domain routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tenantRoutes, { prefix: '/api/tenants' });
  await app.register(patientRoutes, { prefix: '/api/patients' });
  await app.register(medicationRoutes, { prefix: '/api' });
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(careRoutes, { prefix: '/api' });
  await app.register(educationRoutes, { prefix: '/api/education' });
  await app.register(exportRoutes, { prefix: '/api/export' });

  return app;
}

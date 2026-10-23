import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { authenticate } from './auth.js';
import { errorHandler } from './errors.js';
import { initPush, vapidPublicKey } from './push.js';
import { initRealtime } from './realtime.js';
import { startScheduler } from './scheduler.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import * as medicationRoutes from './routes/medications.js';
import * as messageRoutes from './routes/messages.js';
import articleRoutes from './routes/articles.js';
import * as questionnaireRoutes from './routes/questionnaires.js';
import userRoutes from './routes/users.js';
import pushRoutes from './routes/push.js';
import exportRoutes from './routes/export.js';

initPush();

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const api = express.Router();

api.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, time: new Date().toISOString() });
});

// Public
api.use('/auth', authRoutes);
api.get('/push/public-key', (req, res) => res.json({ publicKey: vapidPublicKey() }));
api.use(medicationRoutes.flat); // includes public POST /doses/:id/quick, the rest authenticate themselves

// Authenticated
api.use(authenticate);
api.use('/patients', patientRoutes);
api.use('/patients/:patientId', medicationRoutes.patientScoped);
api.use('/patients/:patientId', messageRoutes.patientScoped);
api.use('/patients/:patientId', questionnaireRoutes.patientScoped);
api.use(messageRoutes.flat);
api.use('/articles', articleRoutes);
api.use('/questionnaires', questionnaireRoutes.router);
api.use('/users', userRoutes);
api.use('/push', pushRoutes);
api.use('/export', exportRoutes);

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use('/api', api);
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);

server.listen(config.port, () => {
  console.log(`[rara] API listening on http://localhost:${config.port}`);
  startScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

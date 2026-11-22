import { Readable } from 'node:stream';
import { prisma, withTenant } from '@dosemate/db';
import { classifyBloodPressure, computeMeanArterialPressure, isBpControlled } from '@dosemate/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { writeAuditLog } from '../lib/audit.js';
import { requireTenantStaff } from '../lib/auth.js';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendStreamingCsv(reply: FastifyReply, filename: string, header: string[], rowGenerator: AsyncGenerator<unknown[]>) {
  async function* toCsvStream() {
    yield `\uFEFF${header.map(csvCell).join(',')}\r\n`;
    for await (const row of rowGenerator) {
      yield `${row.map(csvCell).join(',')}\r\n`;
    }
  }
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  return reply.send(Readable.from(toCsvStream()));
}

export async function exportRoutes(app: FastifyInstance) {
  app.get('/patients.csv', { preHandler: [requireTenantStaff] }, async (req, reply) => {
    const { anonymize } = z.object({ anonymize: z.enum(['0', '1']).default('1') }).parse(req.query);
    const anon = anonymize === '1';
    const tenantId = req.auth.activeTenantId!;

    await writeAuditLog({
      tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.tenantRole ?? req.auth.globalRole,
      action: 'EXPORT_PATIENTS_CSV',
      entityType: 'Export',
      ipAddress: req.ip,
      details: { anonymize: anon },
    });

    const enrollments = await withTenant(tenantId, (tx) =>
      tx.careEnrollment.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: {
          patient: { include: { user: true } },
          pharmacist: { select: { name: true } },
        },
        orderBy: { enrolledAt: 'asc' },
      }),
    );

    const header = anon
      ? ['study_code', 'study_group', 'diagnosis', 'pharmacist', 'enrolled_at']
      : ['study_code', 'name', 'email', 'phone', 'study_group', 'diagnosis', 'pharmacist', 'enrolled_at'];

    async function* rows() {
      for (const e of enrollments) {
        yield anon
          ? [e.studyCode || e.patientId, e.studyGroup, e.patient.diagnosis, e.pharmacist?.name, e.enrolledAt]
          : [
              e.studyCode || '',
              e.patient.user.name,
              e.patient.user.email,
              e.patient.user.phone,
              e.studyGroup,
              e.patient.diagnosis,
              e.pharmacist?.name,
              e.enrolledAt,
            ];
      }
    }

    return sendStreamingCsv(reply, `doselynx-patients-${new Date().toISOString().slice(0, 10)}.csv`, header, rows());
  });

  app.get('/blood-pressure.csv', { preHandler: [requireTenantStaff] }, async (req, reply) => {
    const { anonymize } = z.object({ anonymize: z.enum(['0', '1']).default('1') }).parse(req.query);
    const anon = anonymize === '1';
    const tenantId = req.auth.activeTenantId!;

    await writeAuditLog({
      tenantId,
      actorId: req.auth.userId,
      actorName: req.auth.name,
      actorRole: req.auth.tenantRole ?? req.auth.globalRole,
      action: 'EXPORT_BP_CSV',
      entityType: 'Export',
      ipAddress: req.ip,
      details: { anonymize: anon },
    });

    const enrollments = await withTenant(tenantId, (tx) =>
      tx.careEnrollment.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { patient: { include: { user: { select: { name: true } } } } },
      }),
    );
    const map = new Map(enrollments.map((e) => [e.patientId, e]));
    const ids = [...map.keys()];

    const header = [
      ...(anon ? ['participant'] : ['study_code', 'name']),
      'measured_at',
      'systolic_mmhg',
      'diastolic_mmhg',
      'pulse_bpm',
      'map',
      'controlled',
      'classification',
      'alert_status',
      'source',
    ];

    async function* rows() {
      if (!ids.length) return;
      let cursor: string | undefined;
      while (true) {
        const batch = await prisma.bloodPressureLog.findMany({
          where: { patientId: { in: ids } },
          orderBy: { id: 'asc' },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!batch.length) break;
        for (const l of batch) {
          const e = map.get(l.patientId);
          yield [
            ...(anon ? [e?.studyCode || l.patientId] : [e?.studyCode || '', e?.patient.user.name || '']),
            l.measuredAt,
            l.systolic,
            l.diastolic,
            l.pulse,
            computeMeanArterialPressure(l.systolic, l.diastolic),
            isBpControlled(l) ? 1 : 0,
            classifyBloodPressure(l.systolic, l.diastolic),
            l.alertStatus,
            l.source,
          ];
        }
        cursor = batch[batch.length - 1]?.id;
        if (batch.length < 500) break;
      }
    }

    return sendStreamingCsv(reply, `doselynx-bp-${new Date().toISOString().slice(0, 10)}.csv`, header, rows());
  });
}

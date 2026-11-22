import { prisma } from '@dosemate/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('DoseLynx v2 Security, Multi-Tenancy RLS & Clinical Integrity Suite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let idPharmacistToken = '';
  let sgPharmacistToken = '';
  let idPatientToken = '';
  let sgPatientId = '';
  let idTenantId = '';
  let sgTenantId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const loginIdPharm = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 'apoteker@doselynx.com', password: 'apoteker1234', transport: 'bearer' },
    });
    expect(loginIdPharm.statusCode).toBe(200);
    const idPharmBody = loginIdPharm.json();
    idPharmacistToken = idPharmBody.accessToken;
    idTenantId = idPharmBody.user.activeTenantId;

    const loginSgPharm = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 'daniel@greencross.sg', password: 'apoteker1234', transport: 'bearer' },
    });
    expect(loginSgPharm.statusCode).toBe(200);
    const sgPharmBody = loginSgPharm.json();
    sgPharmacistToken = sgPharmBody.accessToken;
    sgTenantId = sgPharmBody.user.activeTenantId;

    const loginIdPatient = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 'pasien@doselynx.com', password: 'pasien1234', transport: 'bearer' },
    });
    expect(loginIdPatient.statusCode).toBe(200);
    idPatientToken = loginIdPatient.json().accessToken;

    const sgList = await app.inject({
      method: 'GET',
      url: '/api/patients',
      headers: { authorization: `Bearer ${sgPharmacistToken}` },
    });
    expect(sgList.statusCode).toBe(200);
    sgPatientId = sgList.json().patients[0].id;
    expect(sgPatientId).toBeTruthy();
  });

  afterAll(async () => {
    await app.close();
  });

  it('BLOCKS cross-tenant patient read, BP read, and X-Tenant-Id header spoofing via Postgres RLS', async () => {
    // 1. Indonesia pharmacist tries to read Singapore patient directly
    const directRead = await app.inject({
      method: 'GET',
      url: `/api/patients/${sgPatientId}`,
      headers: { authorization: `Bearer ${idPharmacistToken}` },
    });
    expect(directRead.statusCode).toBe(403);
    expect(directRead.json().code).toBe('TENANT_ACCESS_DENIED');

    // 2. Indonesia pharmacist tries to spoof X-Tenant-Id to Singapore tenant
    const spoofedHeader = await app.inject({
      method: 'GET',
      url: '/api/patients',
      headers: {
        authorization: `Bearer ${idPharmacistToken}`,
        'x-tenant-id': sgTenantId,
      },
    });
    expect(spoofedHeader.statusCode).toBe(403);
    expect(spoofedHeader.json().code).toBe('TENANT_ACCESS_DENIED');

    // 3. Indonesia pharmacy CSV export contains ZERO Singapore patients
    const csvExport = await app.inject({
      method: 'GET',
      url: '/api/export/patients.csv?anonymize=0',
      headers: { authorization: `Bearer ${idPharmacistToken}` },
    });
    expect(csvExport.statusCode).toBe(200);
    expect(csvExport.body).toContain('Aisyah Rahmadani');
    expect(csvExport.body).not.toContain('Chloe Lim');
    expect(idTenantId).not.toBe(sgTenantId);
  });

  it('prevents duplicate Blood Pressure entries via Idempotency-Key header on mobile retries', async () => {
    const idempKey = `bp-retry-test-${Date.now()}`;
    const payload = { systolic: 124, diastolic: 79, pulse: 74, note: 'Idempotent retry test' };

    const first = await app.inject({
      method: 'POST',
      url: '/api/patients/me/blood-pressure',
      headers: { authorization: `Bearer ${idPatientToken}`, 'idempotency-key': idempKey },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const firstId = first.json().log.id;

    const second = await app.inject({
      method: 'POST',
      url: '/api/patients/me/blood-pressure',
      headers: { authorization: `Bearer ${idPatientToken}`, 'idempotency-key': idempKey },
      payload,
    });
    expect(second.statusCode).toBe(201);
    expect(second.headers['x-idempotent-replay']).toBe('true');
    expect(second.json().log.id).toBe(firstId);

    // Cleanup test log
    await prisma.bloodPressureLog.delete({ where: { id: firstId } });
  });

  it('versions medication regimens immutably without overwriting prior dosage history', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/patients/me/medications',
      headers: { authorization: `Bearer ${idPatientToken}` },
      payload: {
        displayName: 'Amlodipine Test',
        activeIngredient: 'Amlodipine besylate',
        dosage: '5 mg',
        times: ['08:00'],
        scheduleRule: { type: 'DAILY', mealRelation: 'ANYTIME' },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const v1Med = createRes.json().medication;

    const versionRes = await app.inject({
      method: 'PUT',
      url: `/api/medications/${v1Med.id}/version`,
      headers: { authorization: `Bearer ${idPatientToken}` },
      payload: { dosage: '10 mg' },
    });
    expect(versionRes.statusCode).toBe(201);
    const v2Med = versionRes.json().medication;
    expect(v2Med.dosage).toBe('10 mg');
    expect(v2Med.previousMedicationId).toBe(v1Med.id);

    const oldRow = await prisma.medication.findUnique({ where: { id: v1Med.id } });
    expect(oldRow?.active).toBe(false);
    expect(oldRow?.dosage).toBe('5 mg');

    // Cleanup test versions
    await prisma.medication.deleteMany({ where: { id: { in: [v1Med.id, v2Med.id] } } });
  });

  it('immediately revokes access token when user logs out', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: 'pasien@doselynx.com', password: 'pasien1234', transport: 'bearer' },
    });
    const token = login.json().accessToken;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(afterLogout.statusCode).toBe(401);
    expect(afterLogout.json().code).toBe('AUTH_TOKEN_REVOKED');
  });
});

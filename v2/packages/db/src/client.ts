import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  __dosematePrisma?: PrismaClient;
  __dosemateRuntimePrisma?: PrismaClient;
};

/**
 * Primary Prisma client (migrations, global auth lookup, system workers).
 */
export const prisma =
  globalForPrisma.__dosematePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

/**
 * RLS-enforced runtime Prisma client connecting as non-superuser `dosemate_app` when configured.
 */
export const runtimePrisma =
  globalForPrisma.__dosemateRuntimePrisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL,
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__dosematePrisma = prisma;
  globalForPrisma.__dosemateRuntimePrisma = runtimePrisma;
}

export type TenantTx = Prisma.TransactionClient & {
  readonly __tenantId: string;
};

/**
 * Executes a tenant-scoped database operation inside a PostgreSQL transaction
 * with `set_config('app.tenant_id', tenantId, true)` (`is_local = true`),
 * making it 100% safe under PgBouncer transaction pooling AND enforced by Postgres RLS.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!tenantId) {
    throw new Error('withTenant requires a non-empty tenantId');
  }
  return runtimePrisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    const scopedTx = Object.assign(tx, { __tenantId: tenantId }) as TenantTx;
    return fn(scopedTx);
  });
}

export { Prisma, PrismaClient };

-- DoseMate v2 PostgreSQL Row-Level Security (RLS) Setup
-- Creates dedicated non-superuser role `dosemate_app` and enforces strict tenant isolation
-- across all tenant-scoped clinical tables using `current_setting('app.tenant_id', true)`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'dosemate_app') THEN
    CREATE ROLE dosemate_app LOGIN PASSWORD 'dosemate_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO dosemate_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dosemate_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dosemate_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dosemate_app;

-- Enable & force RLS on strictly tenant-owned clinical tables
ALTER TABLE "CareEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CareEnrollment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_care_enrollment ON "CareEnrollment";
CREATE POLICY tenant_isolation_care_enrollment ON "CareEnrollment"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "PatientFollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PatientFollowUp" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_follow_up ON "PatientFollowUp";
CREATE POLICY tenant_isolation_follow_up ON "PatientFollowUp"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_service_request ON "ServiceRequest";
CREATE POLICY tenant_isolation_service_request ON "ServiceRequest"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_message ON "Message";
CREATE POLICY tenant_isolation_message ON "Message"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "StaffMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffMembership" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_staff_membership ON "StaffMembership";
CREATE POLICY tenant_isolation_staff_membership ON "StaffMembership"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- CreateEnum
CREATE TYPE "CheckupStatus" AS ENUM ('UPCOMING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "durationLabel" TEXT,
ADD COLUMN     "mediaType" TEXT NOT NULL DEFAULT 'ARTICLE',
ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "HealthParameterLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "context" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthParameterLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckupReminder" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CHECKUP',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" "CheckupStatus" NOT NULL DEFAULT 'UPCOMING',
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckupReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthParameterLog_patientId_type_measuredAt_idx" ON "HealthParameterLog"("patientId", "type", "measuredAt");

-- CreateIndex
CREATE INDEX "HealthParameterLog_patientId_measuredAt_idx" ON "HealthParameterLog"("patientId", "measuredAt");

-- CreateIndex
CREATE INDEX "CheckupReminder_patientId_scheduledAt_idx" ON "CheckupReminder"("patientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "CheckupReminder_status_scheduledAt_idx" ON "CheckupReminder"("status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "HealthParameterLog" ADD CONSTRAINT "HealthParameterLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckupReminder" ADD CONSTRAINT "CheckupReminder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PharmacistProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "straNumber" TEXT,
    "sipaNumber" TEXT,
    "workplace" TEXT,
    "specialization" TEXT,
    "yearsExperience" INTEGER,
    "bioId" TEXT,
    "bioEn" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyService" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'TELEPHARMACY',
    "nameId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionId" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "priceIDR" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT NOT NULL DEFAULT 'Stethoscope',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PharmacyService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "pharmacistId" TEXT,
    "preferredDate" TIMESTAMP(3),
    "complaint" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pharmacistReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFollowUp" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "pharmacistId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PTO_REPORT',
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT NOT NULL,
    "drpCategory" TEXT NOT NULL DEFAULT 'NONE',
    "recommendation" TEXT,
    "adherenceRate" DOUBLE PRECISION,
    "latestBp" TEXT,
    "nextFollowUpDate" TIMESTAMP(3),
    "sentViaWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "patientId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "category" TEXT NOT NULL DEFAULT 'DOSE_REMINDER',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "provider" TEXT NOT NULL DEFAULT 'SIMULATOR',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PharmacistProfile_userId_key" ON "PharmacistProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyService_code_key" ON "PharmacyService"("code");

-- CreateIndex
CREATE INDEX "ServiceRequest_patientId_createdAt_idx" ON "ServiceRequest"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_createdAt_idx" ON "ServiceRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PatientFollowUp_patientId_createdAt_idx" ON "PatientFollowUp"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppLog_patientId_createdAt_idx" ON "WhatsAppLog"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppLog_createdAt_idx" ON "WhatsAppLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PharmacistProfile" ADD CONSTRAINT "PharmacistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "PharmacyService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFollowUp" ADD CONSTRAINT "PatientFollowUp_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFollowUp" ADD CONSTRAINT "PatientFollowUp_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

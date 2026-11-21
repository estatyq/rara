-- CreateEnum
CREATE TYPE "StudyGroup" AS ENUM ('INTERVENTION', 'CONTROL');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "baselineDiastolic" INTEGER,
ADD COLUMN     "baselineSystolic" INTEGER,
ADD COLUMN     "estimatedDueDate" TIMESTAMP(3),
ADD COLUMN     "riskFactors" TEXT,
ADD COLUMN     "studyGroup" "StudyGroup" NOT NULL DEFAULT 'INTERVENTION';

-- CreateTable
CREATE TABLE "BloodPressureLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "systolic" INTEGER NOT NULL,
    "diastolic" INTEGER NOT NULL,
    "pulse" INTEGER,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SELF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodPressureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodPressureLog_patientId_measuredAt_idx" ON "BloodPressureLog"("patientId", "measuredAt");

-- AddForeignKey
ALTER TABLE "BloodPressureLog" ADD CONSTRAINT "BloodPressureLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'EXCUSED_ABSENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Attendance"
ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;

ALTER TABLE "Attendance"
ADD COLUMN IF NOT EXISTS "note" TEXT;

-- Backfill note from legacy reason
UPDATE "Attendance"
SET "note" = "reason"
WHERE "note" IS NULL AND "reason" IS NOT NULL;

-- Normalize legacy status values (string) before type change
UPDATE "Attendance"
SET "status" = UPPER(TRIM("status"))
WHERE "status" IS NOT NULL;

UPDATE "Attendance"
SET "status" = CASE
  WHEN "status" IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'EXCUSED_ABSENT') THEN "status"
  WHEN "present" = true THEN 'PRESENT'
  ELSE 'ABSENT'
END;

-- Convert status column to enum and enforce not-null/default
ALTER TABLE "Attendance"
ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::"AttendanceStatus");

ALTER TABLE "Attendance"
ALTER COLUMN "status" SET DEFAULT 'PRESENT';

ALTER TABLE "Attendance"
ALTER COLUMN "status" SET NOT NULL;

-- SetupState: configurable attendance reason codes (school-wide)
ALTER TABLE "SetupState"
ADD COLUMN IF NOT EXISTS "attendanceReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY['SICK','FAMILY','UNCONTACTED']::TEXT[];

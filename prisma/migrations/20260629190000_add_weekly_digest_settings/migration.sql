-- AlterTable
ALTER TABLE "Parent"
ADD COLUMN IF NOT EXISTS "weeklyDigestOptOut" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SetupState"
ADD COLUMN IF NOT EXISTS "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SetupState"
ADD COLUMN IF NOT EXISTS "weeklyDigestDayOfWeek" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SetupState"
ADD COLUMN IF NOT EXISTS "weeklyDigestSendHour" INTEGER NOT NULL DEFAULT 18;

ALTER TABLE "SetupState"
ADD COLUMN IF NOT EXISTS "weeklyDigestSendMinute" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WeeklyDigestLog" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyDigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyDigestLog_dedupeKey_key" ON "WeeklyDigestLog"("dedupeKey");
CREATE INDEX IF NOT EXISTS "WeeklyDigestLog_parentId_idx" ON "WeeklyDigestLog"("parentId");
CREATE INDEX IF NOT EXISTS "WeeklyDigestLog_weekStart_idx" ON "WeeklyDigestLog"("weekStart");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WeeklyDigestLog"
  ADD CONSTRAINT "WeeklyDigestLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
CREATE TYPE "FeeReminderType" AS ENUM ('PRE_DUE', 'OVERDUE');

-- AlterTable
ALTER TABLE "Parent"
ADD COLUMN "feeReminderOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FeeReminderLog" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "type" "FeeReminderType" NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "daysBeforeDue" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FeeReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeReminderLog_dedupeKey_key" ON "FeeReminderLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "FeeReminderLog_invoiceId_idx" ON "FeeReminderLog"("invoiceId");

-- CreateIndex
CREATE INDEX "FeeReminderLog_parentId_idx" ON "FeeReminderLog"("parentId");

-- CreateIndex
CREATE INDEX "FeeReminderLog_type_idx" ON "FeeReminderLog"("type");

-- AddForeignKey
ALTER TABLE "FeeReminderLog"
ADD CONSTRAINT "FeeReminderLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReminderLog"
ADD CONSTRAINT "FeeReminderLog_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

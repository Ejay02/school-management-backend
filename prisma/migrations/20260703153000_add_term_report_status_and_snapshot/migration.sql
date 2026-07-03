-- CreateEnum
CREATE TYPE "TermReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "TermReportRemark"
ADD COLUMN "status" "TermReportStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT,
ADD COLUMN "publishedByRole" "Role",
ADD COLUMN "publishedSnapshot" JSONB;

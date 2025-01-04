-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_gradeId_fkey";

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "gradeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

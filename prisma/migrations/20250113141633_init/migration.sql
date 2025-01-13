-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_gradeId_fkey";

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "gradeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

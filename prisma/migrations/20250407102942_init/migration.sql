/*
  Warnings:

  - Added the required column `lessonId` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "lessonId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

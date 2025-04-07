/*
  Warnings:

  - You are about to drop the column `lessonId` on the `Exam` table. All the data in the column will be lost.
  - Added the required column `date` to the `Exam` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_lessonId_fkey";

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "lessonId",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;

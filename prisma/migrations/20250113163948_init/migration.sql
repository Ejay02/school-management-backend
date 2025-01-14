/*
  Warnings:

  - You are about to drop the column `level` on the `Grade` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,examId,assignmentId,academicPeriod]` on the table `Grade` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicPeriod` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Grade` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GradeType" AS ENUM ('EXAM', 'ASSIGNMENT', 'OVERALL');

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_gradeId_fkey";

-- AlterTable
ALTER TABLE "Grade" DROP COLUMN "level",
ADD COLUMN     "academicPeriod" TEXT NOT NULL,
ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "comments" TEXT,
ADD COLUMN     "examId" TEXT,
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL,
ADD COLUMN     "type" "GradeType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Grade_studentId_examId_assignmentId_academicPeriod_key" ON "Grade"("studentId", "examId", "assignmentId", "academicPeriod");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

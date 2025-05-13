/*
  Warnings:

  - You are about to drop the column `gradeId` on the `Exam` table. All the data in the column will be lost.
  - You are about to drop the column `isOfficialGrade` on the `Result` table. All the data in the column will be lost.
  - The `type` column on the `Result` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `gradeId` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `gradeId` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the `Grade` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `resultId` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('EXAM', 'ASSIGNMENT', 'OVERALL');

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_examId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_gradeId_fkey";

-- DropIndex
DROP INDEX "Student_gradeId_idx";

-- DropIndex
DROP INDEX "Submission_gradeId_idx";

-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "gradeId";

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "isOfficialGrade",
ADD COLUMN     "isOfficialResult" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "type",
ADD COLUMN     "type" "ResultType";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "gradeId";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "gradeId";

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "gradeId",
ADD COLUMN     "resultId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Grade";

-- DropEnum
DROP TYPE "GradeType";

-- CreateIndex
CREATE INDEX "Submission_resultId_idx" ON "Submission"("resultId");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

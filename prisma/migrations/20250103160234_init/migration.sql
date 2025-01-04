/*
  Warnings:

  - The primary key for the `Announcement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Assignment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Attendance` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Class` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Event` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Exam` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Grade` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Lesson` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Result` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Subject` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Submission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_SubjectToTeacher` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `classId` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_classId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_classId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_classId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_classId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_classId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_examId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_classId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_gradeId_fkey";

-- DropForeignKey
ALTER TABLE "_SubjectToTeacher" DROP CONSTRAINT "_SubjectToTeacher_A_fkey";

-- AlterTable
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "classId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Announcement_id_seq";

-- AlterTable
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "lessonId" SET DATA TYPE TEXT,
ALTER COLUMN "classId" SET DATA TYPE TEXT,
ALTER COLUMN "subjectId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Assignment_id_seq";

-- AlterTable
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "lessonId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Attendance_id_seq";

-- AlterTable
ALTER TABLE "Class" DROP CONSTRAINT "Class_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Class_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Class_id_seq";

-- AlterTable
ALTER TABLE "Event" DROP CONSTRAINT "Event_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "classId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Event_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Event_id_seq";

-- AlterTable
ALTER TABLE "Exam" DROP CONSTRAINT "Exam_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "lessonId" SET DATA TYPE TEXT,
ALTER COLUMN "classId" SET DATA TYPE TEXT,
ALTER COLUMN "subjectId" SET DATA TYPE TEXT,
ALTER COLUMN "gradeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Exam_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Exam_id_seq";

-- AlterTable
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Grade_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Grade_id_seq";

-- AlterTable
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "subjectId" SET DATA TYPE TEXT,
ALTER COLUMN "classId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Lesson_id_seq";

-- AlterTable
ALTER TABLE "Result" DROP CONSTRAINT "Result_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "examId" SET DATA TYPE TEXT,
ALTER COLUMN "assignmentId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Result_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Result_id_seq";

-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "classId" SET DATA TYPE TEXT,
ALTER COLUMN "gradeId" DROP DEFAULT,
ALTER COLUMN "gradeId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_pkey",
ADD COLUMN     "classId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "gradeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Subject_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Subject_id_seq";

-- AlterTable
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "assignmentId" SET DATA TYPE TEXT,
ALTER COLUMN "gradeId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Submission_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Submission_id_seq";

-- AlterTable
ALTER TABLE "_SubjectToTeacher" DROP CONSTRAINT "_SubjectToTeacher_AB_pkey",
ALTER COLUMN "A" SET DATA TYPE TEXT,
ADD CONSTRAINT "_SubjectToTeacher_AB_pkey" PRIMARY KEY ("A", "B");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

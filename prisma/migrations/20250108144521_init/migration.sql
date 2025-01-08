/*
  Warnings:

  - A unique constraint covering the columns `[lessonId,studentId,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_studentId_date_key" ON "Attendance"("lessonId", "studentId", "date");

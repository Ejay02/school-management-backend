ALTER TABLE "Admin" ADD COLUMN     "adminId" TEXT;

ALTER TABLE "Student" ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "institutionalEmail" TEXT;

ALTER TABLE "Teacher" ADD COLUMN     "teacherId" TEXT,
ADD COLUMN     "institutionalEmail" TEXT;

ALTER TABLE "SetupState" ADD COLUMN     "schoolDomain" TEXT,
ADD COLUMN     "nextStudentSequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextTeacherSequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextAdminSequence" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "Admin_adminId_key" ON "Admin"("adminId");

CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

CREATE UNIQUE INDEX "Student_institutionalEmail_key" ON "Student"("institutionalEmail");

CREATE UNIQUE INDEX "Teacher_teacherId_key" ON "Teacher"("teacherId");

CREATE UNIQUE INDEX "Teacher_institutionalEmail_key" ON "Teacher"("institutionalEmail");

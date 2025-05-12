-- CreateTable
CREATE TABLE "StudentExam" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "hasTaken" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentExam_studentId_idx" ON "StudentExam"("studentId");

-- CreateIndex
CREATE INDEX "StudentExam_examId_idx" ON "StudentExam"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExam_studentId_examId_key" ON "StudentExam"("studentId", "examId");

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

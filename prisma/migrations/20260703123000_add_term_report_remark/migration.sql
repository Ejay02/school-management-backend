-- CreateTable
CREATE TABLE "TermReportRemark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicPeriod" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "remark" TEXT NOT NULL,
    "authorId" TEXT,
    "authorRole" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermReportRemark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TermReportRemark_studentId_academicPeriod_term_key" ON "TermReportRemark"("studentId", "academicPeriod", "term");

-- CreateIndex
CREATE INDEX "TermReportRemark_classId_academicPeriod_term_idx" ON "TermReportRemark"("classId", "academicPeriod", "term");

-- CreateIndex
CREATE INDEX "TermReportRemark_studentId_idx" ON "TermReportRemark"("studentId");

-- AddForeignKey
ALTER TABLE "TermReportRemark" ADD CONSTRAINT "TermReportRemark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermReportRemark" ADD CONSTRAINT "TermReportRemark_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

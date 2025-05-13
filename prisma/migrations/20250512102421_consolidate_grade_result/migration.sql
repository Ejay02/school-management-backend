-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "academicPeriod" TEXT,
ADD COLUMN     "comments" TEXT,
ADD COLUMN     "isOfficialGrade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "GradeType";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "resultId" TEXT;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

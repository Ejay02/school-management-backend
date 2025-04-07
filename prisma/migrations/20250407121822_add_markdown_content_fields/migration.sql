-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "content" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "instructions" TEXT;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "content" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "instructions" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "content" JSONB,
ADD COLUMN     "description" TEXT;

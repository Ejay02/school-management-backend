-- CreateEnum
CREATE TYPE "FeeDescription" AS ENUM ('TUITION', 'DEVELOPMENT_LEVY', 'UNIFORM', 'BOOKS', 'OTHER');

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "description" "FeeDescription";

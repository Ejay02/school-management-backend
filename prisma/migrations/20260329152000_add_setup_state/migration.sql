-- CreateTable
CREATE TABLE IF NOT EXISTS "SetupState" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT,
    "schoolEmail" TEXT,
    "schoolPhone" TEXT,
    "schoolAddress" TEXT,
    "academicYearCurrent" TEXT,
    "academicYearNext" TEXT,
    "currentTerm" "Term",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupState_pkey" PRIMARY KEY ("id")
);


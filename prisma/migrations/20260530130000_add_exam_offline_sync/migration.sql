ALTER TABLE "StudentExam"
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "answers" JSONB,
ADD COLUMN     "answersVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastClientSyncAt" TIMESTAMP(3),
ADD COLUMN     "answersHash" TEXT,
ADD COLUMN     "clientAnswersHash" TEXT;

CREATE TABLE "StudentExamAnswerOp" (
    "id" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "studentExamId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "questionId" TEXT,
    "payload" JSONB,
    "clientCreatedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "rejectedReason" TEXT,
    "appliedVersion" INTEGER,
    "actorId" TEXT,
    "actorUsername" TEXT,
    "actorRole" "Role",
    "ipAddress" TEXT,

    CONSTRAINT "StudentExamAnswerOp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentExamAnswerOp_opId_key" ON "StudentExamAnswerOp"("opId");
CREATE INDEX "StudentExamAnswerOp_studentExamId_idx" ON "StudentExamAnswerOp"("studentExamId");
CREATE INDEX "StudentExamAnswerOp_receivedAt_idx" ON "StudentExamAnswerOp"("receivedAt");

ALTER TABLE "StudentExamAnswerOp" ADD CONSTRAINT "StudentExamAnswerOp_studentExamId_fkey" FOREIGN KEY ("studentExamId") REFERENCES "StudentExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PasswordSetupPurpose" AS ENUM ('STUDENT_PASSWORD_SETUP');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordSetupToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "PasswordSetupPurpose" NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordSetupToken_token_key" ON "PasswordSetupToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_userId_idx" ON "PasswordSetupToken"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_expiresAt_idx" ON "PasswordSetupToken"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordSetupToken_purpose_role_idx" ON "PasswordSetupToken"("purpose", "role");


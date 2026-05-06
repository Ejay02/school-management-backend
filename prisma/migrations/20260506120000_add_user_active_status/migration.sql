ALTER TABLE "Admin"
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

ALTER TABLE "Teacher"
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

ALTER TABLE "Student"
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

ALTER TABLE "Parent"
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3);

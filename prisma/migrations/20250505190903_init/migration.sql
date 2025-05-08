-- AlterTable
ALTER TABLE "AnnouncementRead" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AnnouncementArchive" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementArchive_userId_idx" ON "AnnouncementArchive"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementArchive_announcementId_userId_key" ON "AnnouncementArchive"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "AnnouncementArchive" ADD CONSTRAINT "AnnouncementArchive_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `date` on the `Announcement` table. All the data in the column will be lost.
  - Added the required column `creatorId` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creatorRole` to the `Announcement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "date",
ADD COLUMN     "creatorId" TEXT NOT NULL,
ADD COLUMN     "creatorRole" TEXT NOT NULL;

/*
  Warnings:

  - You are about to drop the column `adminId` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `teacherId` on the `Announcement` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_adminId_fkey";

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_teacherId_fkey";

-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "adminId",
DROP COLUMN "teacherId";

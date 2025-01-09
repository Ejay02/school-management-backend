/*
  Warnings:

  - You are about to drop the column `adminId` on the `Event` table. All the data in the column will be lost.
  - Added the required column `creatorId` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_adminId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "adminId",
ADD COLUMN     "creatorId" TEXT NOT NULL;

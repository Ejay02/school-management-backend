/*
  Warnings:

  - Added the required column `type` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "location" TEXT,
ADD COLUMN     "type" TEXT NOT NULL;

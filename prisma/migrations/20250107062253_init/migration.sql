/*
  Warnings:

  - Changed the type of `creatorRole` on the `Announcement` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "creatorRole",
ADD COLUMN     "creatorRole" "Role" NOT NULL;

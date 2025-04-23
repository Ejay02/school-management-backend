/*
  Warnings:

  - You are about to drop the column `img` on the `Admin` table. All the data in the column will be lost.
  - You are about to drop the column `img` on the `Parent` table. All the data in the column will be lost.
  - You are about to drop the column `img` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `img` on the `Teacher` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Admin" DROP COLUMN "img",
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "Parent" DROP COLUMN "img",
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "img",
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "img",
ADD COLUMN     "image" TEXT;

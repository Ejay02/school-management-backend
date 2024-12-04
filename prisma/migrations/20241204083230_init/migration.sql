/*
  Warnings:

  - Added the required column `password` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Parent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Parent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'PARENT', 'STUDENT');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL;

-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "password" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL;

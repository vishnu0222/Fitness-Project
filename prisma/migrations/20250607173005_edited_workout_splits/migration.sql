/*
  Warnings:

  - You are about to drop the column `Variations` on the `Exercises` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exercises" DROP COLUMN "Variations",
ADD COLUMN     "sets" TEXT;

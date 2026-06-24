/*
  Warnings:

  - You are about to drop the column `ExerciseName` on the `Exercises` table. All the data in the column will be lost.
  - Added the required column `exerciseName` to the `Exercises` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sets` to the `Exercises` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Exercises" DROP COLUMN "ExerciseName",
ADD COLUMN     "exerciseName" TEXT NOT NULL,
DROP COLUMN "sets",
ADD COLUMN     "sets" INTEGER NOT NULL;

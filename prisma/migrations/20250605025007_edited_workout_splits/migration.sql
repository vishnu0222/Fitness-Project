/*
  Warnings:

  - You are about to drop the column `workoutName` on the `WorkoutSplit` table. All the data in the column will be lost.
  - Added the required column `workoutSplitName` to the `WorkoutSplit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkoutSplit" DROP COLUMN "workoutName",
ADD COLUMN     "workoutSplitName" TEXT NOT NULL;

-- DropForeignKey
ALTER TABLE "Exercises" DROP CONSTRAINT "Exercises_splitId_fkey";

-- DropForeignKey
ALTER TABLE "WorkoutSplit" DROP CONSTRAINT "WorkoutSplit_planId_fkey";

-- AddForeignKey
ALTER TABLE "WorkoutSplit" ADD CONSTRAINT "WorkoutSplit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercises" ADD CONSTRAINT "Exercises_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "WorkoutSplit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

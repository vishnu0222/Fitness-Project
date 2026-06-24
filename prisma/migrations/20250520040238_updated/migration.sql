/*
  Warnings:

  - You are about to drop the `ChallengeParticipant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChallengeParticipant" DROP CONSTRAINT "ChallengeParticipant_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "ChallengeParticipant" DROP CONSTRAINT "ChallengeParticipant_userId_fkey";

-- DropTable
DROP TABLE "ChallengeParticipant";

-- CreateTable
CREATE TABLE "ChallengeEnrollment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" DOUBLE PRECISION,

    CONSTRAINT "ChallengeEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEnrollment_userId_challengeId_key" ON "ChallengeEnrollment"("userId", "challengeId");

-- AddForeignKey
ALTER TABLE "ChallengeEnrollment" ADD CONSTRAINT "ChallengeEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEnrollment" ADD CONSTRAINT "ChallengeEnrollment_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

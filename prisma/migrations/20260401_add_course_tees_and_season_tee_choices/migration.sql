CREATE TYPE "TeeColor" AS ENUM ('blue', 'white', 'yellow');

CREATE TABLE "CourseTee" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "color" "TeeColor" NOT NULL,
    "nineHolePar" INTEGER NOT NULL,
    "nineHoleRating" DOUBLE PRECISION NOT NULL,
    "nineHoleSlope" INTEGER NOT NULL,

    CONSTRAINT "CourseTee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerSeasonTee" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teeColor" "TeeColor" NOT NULL DEFAULT 'white',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerSeasonTee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseTee_courseId_color_key" ON "CourseTee"("courseId", "color");
CREATE UNIQUE INDEX "PlayerSeasonTee_playerId_seasonId_key" ON "PlayerSeasonTee"("playerId", "seasonId");

ALTER TABLE "CourseTee" ADD CONSTRAINT "CourseTee_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSeasonTee" ADD CONSTRAINT "PlayerSeasonTee_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSeasonTee" ADD CONSTRAINT "PlayerSeasonTee_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

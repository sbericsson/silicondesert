CREATE TYPE "HandicapMode" AS ENUM ('index', 'course');

ALTER TABLE "Week"
ADD COLUMN "handicapMode" "HandicapMode" NOT NULL DEFAULT 'course';

ALTER TABLE "Match"
ADD COLUMN "player1PlayingHandicap" INTEGER,
ADD COLUMN "player2PlayingHandicap" INTEGER;

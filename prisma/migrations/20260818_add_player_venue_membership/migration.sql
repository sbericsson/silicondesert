CREATE TABLE "PlayerVenueMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerVenueMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerVenueMembership_playerId_venue_key"
ON "PlayerVenueMembership"("playerId", "venue");

CREATE INDEX "PlayerVenueMembership_venue_idx"
ON "PlayerVenueMembership"("venue");

ALTER TABLE "PlayerVenueMembership"
ADD CONSTRAINT "PlayerVenueMembership_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

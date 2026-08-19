-- Oakwood and Ironwood membership are the same entitlement, so membership is a
-- property of the player rather than of a venue. Collapse the join table into a
-- single flag, carrying over anyone already recorded as a member of any venue.

ALTER TABLE "Player" ADD COLUMN "courseMember" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Player"
SET "courseMember" = true
WHERE "id" IN (SELECT DISTINCT "playerId" FROM "PlayerVenueMembership");

DROP TABLE "PlayerVenueMembership";

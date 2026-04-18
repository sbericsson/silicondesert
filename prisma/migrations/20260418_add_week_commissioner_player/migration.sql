ALTER TABLE "Week"
ADD COLUMN "commissionerPlayerId" TEXT;

ALTER TABLE "Week"
ADD CONSTRAINT "Week_commissionerPlayerId_fkey"
FOREIGN KEY ("commissionerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

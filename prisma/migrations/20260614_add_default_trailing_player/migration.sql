ALTER TABLE "Commissioner"
ADD COLUMN "defaultTrailingPlayerId" TEXT;

ALTER TABLE "Commissioner"
ADD CONSTRAINT "Commissioner_defaultTrailingPlayerId_fkey"
FOREIGN KEY ("defaultTrailingPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

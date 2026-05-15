\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _legacy_differential_import (
  "player_name" TEXT NOT NULL,
  "played_on" DATE NOT NULL,
  "provided_differential" DOUBLE PRECISION NOT NULL,
  "source_sheet" TEXT NOT NULL,
  "source_cell" TEXT NOT NULL
);

\copy _legacy_differential_import ("player_name","played_on","provided_differential","source_sheet","source_cell") FROM '/Users/sericsson/Desktop/silicon/outputs/historical-differential-import/historical_differentials_import.csv' WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE _legacy_differential_resolved AS
SELECT
  source.*,
  player_match."id" AS player_id
FROM _legacy_differential_import source
LEFT JOIN LATERAL (
  SELECT p."id"
  FROM "Player" p
  WHERE regexp_replace(lower(p."name"), '\s+', ' ', 'g')
      = regexp_replace(lower(source."player_name"), '\s+', ' ', 'g')
  ORDER BY p."createdAt" ASC, p."id" ASC
  LIMIT 1
) player_match ON true;

CREATE TEMP TABLE _legacy_differential_unmatched_players AS
SELECT DISTINCT "player_name"
FROM _legacy_differential_resolved
WHERE player_id IS NULL
ORDER BY "player_name";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _legacy_differential_unmatched_players) THEN
    RAISE EXCEPTION 'Spreadsheet contains players that do not exist in the app. See _legacy_differential_unmatched_players.';
  END IF;
END $$;

CREATE TEMP TABLE _legacy_current_rounds AS
SELECT
  source.*,
  week_record."id" AS week_id,
  handicap_record."id" AS handicap_record_id,
  handicap_record."grossScore" AS existing_gross_score,
  handicap_record."adjustedGrossScore" AS existing_adjusted_gross_score
FROM _legacy_differential_resolved source
LEFT JOIN "Week" week_record
  ON week_record."date"::DATE = source."played_on"
LEFT JOIN "HandicapRecord" handicap_record
  ON handicap_record."playerId" = source.player_id
 AND handicap_record."weekId" = week_record."id"
WHERE source."played_on" IN (DATE '2026-04-10', DATE '2026-04-17');

CREATE TEMP TABLE _legacy_missing_current_rounds AS
SELECT *
FROM _legacy_current_rounds
WHERE handicap_record_id IS NULL
ORDER BY "played_on", "player_name";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _legacy_missing_current_rounds) THEN
    RAISE EXCEPTION 'Spreadsheet contains April 10/17 differentials without existing app score records. See _legacy_missing_current_rounds.';
  END IF;
END $$;

CREATE TEMP TABLE _legacy_affected_players AS
SELECT DISTINCT player_id
FROM _legacy_differential_resolved;

DELETE FROM "HandicapRecord" hr
USING _legacy_affected_players affected
WHERE hr."playerId" = affected.player_id
  AND hr."weekId" IS NULL
  AND hr."isImported" = true;

UPDATE "HandicapRecord" hr
SET
  "countsForHandicap" = false,
  "usedInIndex" = false
FROM _legacy_affected_players affected
WHERE hr."playerId" = affected.player_id
  AND hr."date"::DATE < DATE '2026-04-10';

INSERT INTO "HandicapRecord" (
  "playerId",
  "weekId",
  "date",
  "grossScore",
  "adjustedGrossScore",
  "courseRating",
  "slopeRating",
  "coursePar",
  "courseDifferential",
  "usedInIndex",
  "isImported",
  "countsForHandicap"
)
SELECT
  source.player_id,
  NULL,
  source."played_on"::TIMESTAMP + INTERVAL '7 hours',
  0,
  0,
  0 - source."provided_differential",
  113,
  36,
  source."provided_differential",
  false,
  true,
  true
FROM _legacy_differential_resolved source
WHERE source."played_on" < DATE '2026-04-10'
ON CONFLICT ("playerId","date","grossScore")
DO UPDATE SET
  "adjustedGrossScore" = EXCLUDED."adjustedGrossScore",
  "courseRating" = EXCLUDED."courseRating",
  "slopeRating" = EXCLUDED."slopeRating",
  "coursePar" = EXCLUDED."coursePar",
  "courseDifferential" = EXCLUDED."courseDifferential",
  "weekId" = NULL,
  "isImported" = true,
  "countsForHandicap" = true;

UPDATE "HandicapRecord" hr
SET
  "courseDifferential" = current_round."provided_differential",
  "countsForHandicap" = true
FROM _legacy_current_rounds current_round
WHERE hr."id" = current_round.handicap_record_id;

UPDATE "HandicapRecord" hr
SET "usedInIndex" = false
WHERE hr."playerId" IN (SELECT player_id FROM _legacy_affected_players);

WITH recent AS (
  SELECT
    hr."id",
    hr."playerId",
    hr."courseDifferential",
    hr."date",
    hr."createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY hr."playerId"
      ORDER BY hr."date" DESC, hr."createdAt" DESC, hr."id" DESC
    ) AS recent_rank,
    COUNT(*) OVER (PARTITION BY hr."playerId") AS total_records
  FROM "HandicapRecord" hr
  WHERE hr."playerId" IN (SELECT player_id FROM _legacy_affected_players)
    AND hr."countsForHandicap" = true
),
recent_twenty AS (
  SELECT
    recent.*,
    LEAST(recent.total_records, 20) AS recent_count
  FROM recent
  WHERE recent.recent_rank <= 20
),
scored AS (
  SELECT
    recent_twenty.*,
    CASE
      WHEN recent_twenty.recent_count <= 5 THEN 1
      WHEN recent_twenty.recent_count <= 8 THEN 2
      WHEN recent_twenty.recent_count <= 11 THEN 3
      WHEN recent_twenty.recent_count <= 14 THEN 4
      WHEN recent_twenty.recent_count <= 16 THEN 5
      WHEN recent_twenty.recent_count <= 18 THEN 6
      WHEN recent_twenty.recent_count = 19 THEN 7
      ELSE 8
    END AS use_count,
    ROW_NUMBER() OVER (
      PARTITION BY recent_twenty."playerId"
      ORDER BY recent_twenty."courseDifferential" ASC, recent_twenty."date" ASC, recent_twenty."createdAt" ASC, recent_twenty."id" ASC
    ) AS differential_rank
  FROM recent_twenty
)
UPDATE "HandicapRecord" hr
SET "usedInIndex" = true
FROM scored
WHERE hr."id" = scored."id"
  AND scored.differential_rank <= scored.use_count;

SELECT COUNT(*) AS spreadsheet_rows FROM _legacy_differential_import;
SELECT COUNT(*) AS historical_insert_rows
FROM _legacy_differential_resolved
WHERE "played_on" < DATE '2026-04-10';
SELECT COUNT(*) AS current_week_differential_updates
FROM _legacy_current_rounds;
SELECT COUNT(*) AS affected_players
FROM _legacy_affected_players;

COMMIT;

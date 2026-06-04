UPDATE "Week"
SET "handicapMode" = 'index'
WHERE "handicapMode" <> 'index'
  AND "startedAt" IS NULL
  AND "completedAt" IS NULL
  AND "locked" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "Match"
    WHERE "Match"."weekId" = "Week"."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "Attendance"
    WHERE "Attendance"."weekId" = "Week"."id"
      AND "Attendance"."present" = true
  );

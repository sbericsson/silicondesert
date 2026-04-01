DO $$
BEGIN
    ALTER TYPE "TeeColor" ADD VALUE IF NOT EXISTS 'silver';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "Gender" AS ENUM ('man', 'woman');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Player"
ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'man';

ALTER TABLE "CourseTee"
ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'man';

DROP INDEX IF EXISTS "CourseTee_courseId_color_key";

CREATE UNIQUE INDEX "CourseTee_courseId_color_gender_key"
ON "CourseTee"("courseId", "color", "gender");

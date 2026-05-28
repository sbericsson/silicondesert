ALTER TABLE "CourseHole" ADD COLUMN "womenStrokeIndex" INTEGER;
UPDATE "CourseHole" SET "womenStrokeIndex" = "strokeIndex";
ALTER TABLE "CourseHole" ALTER COLUMN "womenStrokeIndex" SET NOT NULL;

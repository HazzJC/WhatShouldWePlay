ALTER TABLE "Game"
ADD COLUMN "steamReviewScore" INTEGER,
ADD COLUMN "steamReviewPercent" INTEGER,
ADD COLUMN "steamReviewTotal" INTEGER,
ADD COLUMN "steamReviewSummary" TEXT,
ADD COLUMN "qualitySource" TEXT,
ADD COLUMN "qualityFetchedAt" TIMESTAMP(3);


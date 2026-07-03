CREATE TYPE "WorkspaceType" AS ENUM ('PLAN', 'PICK');

CREATE TABLE "GameNight" (
  "id" TEXT NOT NULL,
  "shareToken" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameNight_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Session"
  ADD COLUMN "gameNightId" TEXT,
  ADD COLUMN "workspaceType" "WorkspaceType" NOT NULL DEFAULT 'PLAN';

INSERT INTO "GameNight" ("id", "shareToken", "title", "ownerUserId", "createdAt", "updatedAt")
SELECT
  'legacy_' || s."id",
  s."shareToken",
  s."title",
  (
    SELECT p."userId"
    FROM "Participant" p
    WHERE p."sessionId" = s."id" AND p."isHost" = true
    LIMIT 1
  ),
  s."createdAt",
  s."updatedAt"
FROM "Session" s;

UPDATE "Session"
SET "gameNightId" = 'legacy_' || "id";

CREATE UNIQUE INDEX "GameNight_shareToken_key" ON "GameNight"("shareToken");
CREATE INDEX "GameNight_ownerUserId_updatedAt_idx" ON "GameNight"("ownerUserId", "updatedAt");
CREATE UNIQUE INDEX "Session_gameNightId_workspaceType_key" ON "Session"("gameNightId", "workspaceType");
CREATE INDEX "Session_gameNightId_idx" ON "Session"("gameNightId");

ALTER TABLE "GameNight"
  ADD CONSTRAINT "GameNight_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_gameNightId_fkey"
  FOREIGN KEY ("gameNightId") REFERENCES "GameNight"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

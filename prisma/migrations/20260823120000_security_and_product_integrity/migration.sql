-- Participant identity is now one row per signed-in user and workspace. Merge
-- any historical duplicates before enabling the database-level invariant.
CREATE TEMP TABLE "ParticipantMerge" AS
SELECT id AS "oldId", FIRST_VALUE(id) OVER (
  PARTITION BY "sessionId", "userId" ORDER BY "createdAt", id
) AS "keepId"
FROM "Participant"
WHERE "userId" IS NOT NULL;

DELETE FROM "ParticipantMerge" WHERE "oldId" = "keepId";

-- Preserve a durable pre-merge report, including all participant-owned data,
-- before consolidating rows. This makes the production migration auditable and
-- provides enough source data for a targeted manual rollback if required.
CREATE TABLE "ParticipantMergeAudit" (
  "oldParticipantId" TEXT NOT NULL,
  "keptParticipantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParticipantMergeAudit_pkey" PRIMARY KEY ("oldParticipantId")
);
CREATE INDEX "ParticipantMergeAudit_sessionId_userId_idx"
  ON "ParticipantMergeAudit"("sessionId", "userId");
CREATE INDEX "ParticipantMergeAudit_keptParticipantId_idx"
  ON "ParticipantMergeAudit"("keptParticipantId");
INSERT INTO "ParticipantMergeAudit" (
  "oldParticipantId", "keptParticipantId", "sessionId", "userId", "snapshot"
)
SELECT
  participant.id,
  merge."keepId",
  participant."sessionId",
  participant."userId",
  jsonb_build_object(
    'participant', to_jsonb(participant),
    'availability', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "AvailabilityResponse" item WHERE item."participantId" = participant.id), '[]'::jsonb),
    'signals', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "SessionGameSignal" item WHERE item."participantId" = participant.id), '[]'::jsonb),
    'interests', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "SessionGameInterest" item WHERE item."participantId" = participant.id), '[]'::jsonb),
    'preferences', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "ParticipantPreference" item WHERE item."participantId" = participant.id), '[]'::jsonb),
    'addedGames', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "SessionGame" item WHERE item."addedByParticipantId" = participant.id), '[]'::jsonb),
    'discordAttendance', coalesce((SELECT jsonb_agg(to_jsonb(item)) FROM "DiscordAttendance" item WHERE item."participantId" = participant.id), '[]'::jsonb)
  )
FROM "ParticipantMerge" merge
JOIN "Participant" participant ON participant.id = merge."oldId";

DELETE FROM "AvailabilityResponse" old
USING "ParticipantMerge" merge
WHERE old."participantId" = merge."oldId"
  AND EXISTS (
    SELECT 1 FROM "AvailabilityResponse" kept
    WHERE kept."participantId" = merge."keepId"
      AND kept."slotStart" = old."slotStart"
  );
UPDATE "AvailabilityResponse" response SET "participantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE response."participantId" = merge."oldId";

DELETE FROM "SessionGameSignal" old
USING "ParticipantMerge" merge
WHERE old."participantId" = merge."oldId"
  AND EXISTS (
    SELECT 1 FROM "SessionGameSignal" kept
    WHERE kept."participantId" = merge."keepId"
      AND kept."sessionGameId" = old."sessionGameId"
  );
UPDATE "SessionGameSignal" signal SET "participantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE signal."participantId" = merge."oldId";

DELETE FROM "SessionGameInterest" old
USING "ParticipantMerge" merge
WHERE old."participantId" = merge."oldId"
  AND EXISTS (
    SELECT 1 FROM "SessionGameInterest" kept
    WHERE kept."participantId" = merge."keepId"
      AND kept."sessionGameId" = old."sessionGameId"
  );
UPDATE "SessionGameInterest" interest SET "participantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE interest."participantId" = merge."oldId";

DELETE FROM "ParticipantPreference" old
USING "ParticipantMerge" merge
WHERE old."participantId" = merge."oldId"
  AND EXISTS (
    SELECT 1 FROM "ParticipantPreference" kept
    WHERE kept."participantId" = merge."keepId"
  );
UPDATE "ParticipantPreference" preference SET "participantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE preference."participantId" = merge."oldId";

UPDATE "SessionGame" game SET "addedByParticipantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE game."addedByParticipantId" = merge."oldId";
UPDATE "DiscordAttendance" attendance SET "participantId" = merge."keepId"
FROM "ParticipantMerge" merge WHERE attendance."participantId" = merge."oldId";
DELETE FROM "Participant" participant USING "ParticipantMerge" merge
WHERE participant.id = merge."oldId";

DROP INDEX IF EXISTS "Participant_sessionId_userId_idx";
CREATE UNIQUE INDEX "Participant_sessionId_userId_key"
  ON "Participant"("sessionId", "userId");

CREATE TYPE "UserRole" AS ENUM ('USER', 'METADATA_ADMIN');
CREATE TYPE "GameNightStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

ALTER TABLE "User"
  ADD COLUMN "timezone" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

ALTER TABLE "Session" ADD COLUMN "priceAlertsCheckedAt" TIMESTAMP(3);
CREATE INDEX "Session_workspaceType_priceAlertsCheckedAt_idx"
  ON "Session"("workspaceType", "priceAlertsCheckedAt");

ALTER TABLE "GameNight"
  ADD COLUMN "status" "GameNightStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "selectedSessionGameId" TEXT;
UPDATE "GameNight" SET "lastActivityAt" = "updatedAt";
CREATE UNIQUE INDEX "GameNight_selectedSessionGameId_key" ON "GameNight"("selectedSessionGameId");
CREATE INDEX "GameNight_ownerUserId_lastActivityAt_idx" ON "GameNight"("ownerUserId", "lastActivityAt");
CREATE INDEX "GameNight_status_lastActivityAt_idx" ON "GameNight"("status", "lastActivityAt");
DROP INDEX IF EXISTS "GameNight_ownerUserId_updatedAt_idx";
ALTER TABLE "GameNight" ADD CONSTRAINT "GameNight_selectedSessionGameId_fkey"
  FOREIGN KEY ("selectedSessionGameId") REFERENCES "SessionGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "GameDeal" SET "country" = 'GB' WHERE "country" IS NULL;
ALTER TABLE "GameDeal" ALTER COLUMN "country" SET NOT NULL;
DROP INDEX IF EXISTS "GameDeal_gameId_key";
CREATE UNIQUE INDEX "GameDeal_gameId_country_key" ON "GameDeal"("gameId", "country");

ALTER TABLE "DiscordNotificationLog"
  ADD COLUMN "notificationKey" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "DiscordNotificationLog"
SET "notificationKey" = concat(
  "sessionId", ':', coalesce("guildId", 'no-guild'), ':',
  coalesce("channelId", 'no-channel'), ':', "type", ':',
  to_char("scheduledFor" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);
ALTER TABLE "DiscordNotificationLog" ALTER COLUMN "notificationKey" SET NOT NULL;
DROP INDEX IF EXISTS "DiscordNotificationLog_sessionId_type_scheduledFor_key";
DROP INDEX IF EXISTS "DiscordNotificationLog_scheduledFor_status_idx";
CREATE UNIQUE INDEX "DiscordNotificationLog_notificationKey_key" ON "DiscordNotificationLog"("notificationKey");
CREATE INDEX "DiscordNotificationLog_nextAttemptAt_status_idx" ON "DiscordNotificationLog"("nextAttemptAt", status);

ALTER TABLE "PriceAlertEvent"
  ADD COLUMN "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

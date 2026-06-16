CREATE TYPE "SessionMode" AS ENUM ('ONLINE', 'IN_PERSON');

CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'MAYBE', 'UNAVAILABLE');

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "shareToken" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "mode" "SessionMode" NOT NULL,
  "requiredDuration" INTEGER NOT NULL,
  "requiredPlayerCount" INTEGER NOT NULL,
  "dateRangeStart" TIMESTAMP(3) NOT NULL,
  "dateRangeEnd" TIMESTAMP(3) NOT NULL,
  "dailyStartHour" INTEGER NOT NULL,
  "dailyEndHour" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL,
  "discordChannel" TEXT,
  "reminderPreferences" JSONB NOT NULL,
  "lockedStartTime" TIMESTAMP(3),
  "lockedEndTime" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isHost" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilityResponse" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "slotStart" TIMESTAMP(3) NOT NULL,
  "slotEnd" TIMESTAMP(3) NOT NULL,
  "status" "AvailabilityStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AvailabilityResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_shareToken_key" ON "Session"("shareToken");

CREATE INDEX "Participant_sessionId_idx" ON "Participant"("sessionId");

CREATE UNIQUE INDEX "AvailabilityResponse_participantId_slotStart_key" ON "AvailabilityResponse"("participantId", "slotStart");

CREATE INDEX "AvailabilityResponse_slotStart_idx" ON "AvailabilityResponse"("slotStart");

ALTER TABLE "Participant"
  ADD CONSTRAINT "Participant_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AvailabilityResponse"
  ADD CONSTRAINT "AvailabilityResponse_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

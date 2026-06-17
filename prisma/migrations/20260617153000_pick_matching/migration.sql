CREATE TYPE "GameInterestSignal" AS ENUM ('WANT_TO_PLAY', 'NEUTRAL', 'NOT_TONIGHT');

ALTER TABLE "Game"
  ADD COLUMN "minPlayers" INTEGER,
  ADD COLUMN "maxPlayers" INTEGER,
  ADD COLUMN "onlineCoop" BOOLEAN,
  ADD COLUMN "localCoop" BOOLEAN,
  ADD COLUMN "capabilitySource" TEXT,
  ADD COLUMN "capabilityConfidence" DOUBLE PRECISION;

CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "familiarVsNew" INTEGER NOT NULL DEFAULT 50,
  "coOpVsCompetitive" INTEGER NOT NULL DEFAULT 75,
  "priceImportance" INTEGER NOT NULL DEFAULT 50,
  "genreImportance" INTEGER NOT NULL DEFAULT 50,
  "ownershipImportance" INTEGER NOT NULL DEFAULT 75,
  "backlogImportance" INTEGER NOT NULL DEFAULT 50,
  "shortVsLong" INTEGER NOT NULL DEFAULT 50,
  "chillVsIntense" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParticipantPreference" (
  "id" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "familiarVsNew" INTEGER NOT NULL DEFAULT 50,
  "coOpVsCompetitive" INTEGER NOT NULL DEFAULT 75,
  "priceImportance" INTEGER NOT NULL DEFAULT 50,
  "genreImportance" INTEGER NOT NULL DEFAULT 50,
  "ownershipImportance" INTEGER NOT NULL DEFAULT 75,
  "backlogImportance" INTEGER NOT NULL DEFAULT 50,
  "shortVsLong" INTEGER NOT NULL DEFAULT 50,
  "chillVsIntense" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParticipantPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SteamStorePrice" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "steamAppId" INTEGER NOT NULL,
  "currency" TEXT,
  "initialPrice" INTEGER,
  "finalPrice" INTEGER,
  "discountPercent" INTEGER,
  "status" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SteamStorePrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionGameInterest" (
  "id" TEXT NOT NULL,
  "sessionGameId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "interest" "GameInterestSignal" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SessionGameInterest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE UNIQUE INDEX "ParticipantPreference_participantId_key" ON "ParticipantPreference"("participantId");
CREATE UNIQUE INDEX "SteamStorePrice_gameId_key" ON "SteamStorePrice"("gameId");
CREATE UNIQUE INDEX "SteamStorePrice_steamAppId_key" ON "SteamStorePrice"("steamAppId");
CREATE INDEX "SteamStorePrice_fetchedAt_idx" ON "SteamStorePrice"("fetchedAt");
CREATE UNIQUE INDEX "SessionGameInterest_sessionGameId_participantId_key" ON "SessionGameInterest"("sessionGameId", "participantId");
CREATE INDEX "SessionGameInterest_participantId_idx" ON "SessionGameInterest"("participantId");

ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParticipantPreference"
  ADD CONSTRAINT "ParticipantPreference_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SteamStorePrice"
  ADD CONSTRAINT "SteamStorePrice_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGameInterest"
  ADD CONSTRAINT "SessionGameInterest_sessionGameId_fkey"
  FOREIGN KEY ("sessionGameId") REFERENCES "SessionGame"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGameInterest"
  ADD CONSTRAINT "SessionGameInterest_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "UserGameSource" AS ENUM ('STEAM', 'MANUAL', 'IGDB');

CREATE TYPE "SessionGameSource" AS ENUM ('STEAM_MATCH', 'MANUAL', 'IGDB_SEARCH', 'POPULAR', 'TRENDING', 'COMMON', 'FRIEND_ADDED');

CREATE TYPE "SessionGameSignalType" AS ENUM ('OWNED', 'AVAILABLE_TO_PLAY', 'NOT_AVAILABLE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SteamAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "steamId" TEXT NOT NULL,
  "personaName" TEXT,
  "avatarUrl" TEXT,
  "lastImportAt" TIMESTAMP(3),
  "lastImportStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SteamAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Game" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "steamAppId" INTEGER,
  "igdbId" INTEGER,
  "coverUrl" TEXT,
  "summary" TEXT,
  "genres" JSONB NOT NULL DEFAULT '[]',
  "platforms" JSONB NOT NULL DEFAULT '[]',
  "gameModes" JSONB NOT NULL DEFAULT '[]',
  "popularityScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserGame" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "source" "UserGameSource" NOT NULL,
  "playtimeMinutes" INTEGER,
  "recentlyPlayedAt" TIMESTAMP(3),
  "lastImportedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserGame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionGame" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "addedByParticipantId" TEXT,
  "addedByUserId" TEXT,
  "source" "SessionGameSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SessionGame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionGameSignal" (
  "id" TEXT NOT NULL,
  "sessionGameId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "signal" "SessionGameSignalType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SessionGameSignal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Participant" ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

CREATE UNIQUE INDEX "SteamAccount_userId_key" ON "SteamAccount"("userId");
CREATE UNIQUE INDEX "SteamAccount_steamId_key" ON "SteamAccount"("steamId");

CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");
CREATE INDEX "Game_normalizedTitle_idx" ON "Game"("normalizedTitle");

CREATE UNIQUE INDEX "UserGame_userId_gameId_key" ON "UserGame"("userId", "gameId");
CREATE INDEX "UserGame_gameId_idx" ON "UserGame"("gameId");

CREATE UNIQUE INDEX "SessionGame_sessionId_gameId_key" ON "SessionGame"("sessionId", "gameId");
CREATE INDEX "SessionGame_gameId_idx" ON "SessionGame"("gameId");
CREATE INDEX "SessionGame_addedByParticipantId_idx" ON "SessionGame"("addedByParticipantId");
CREATE INDEX "SessionGame_addedByUserId_idx" ON "SessionGame"("addedByUserId");

CREATE UNIQUE INDEX "SessionGameSignal_sessionGameId_participantId_key" ON "SessionGameSignal"("sessionGameId", "participantId");
CREATE INDEX "SessionGameSignal_participantId_idx" ON "SessionGameSignal"("participantId");

CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");

ALTER TABLE "Participant"
  ADD CONSTRAINT "Participant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserSession"
  ADD CONSTRAINT "UserSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SteamAccount"
  ADD CONSTRAINT "SteamAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGame"
  ADD CONSTRAINT "UserGame_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGame"
  ADD CONSTRAINT "UserGame_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGame"
  ADD CONSTRAINT "SessionGame_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGame"
  ADD CONSTRAINT "SessionGame_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGame"
  ADD CONSTRAINT "SessionGame_addedByParticipantId_fkey"
  FOREIGN KEY ("addedByParticipantId") REFERENCES "Participant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionGame"
  ADD CONSTRAINT "SessionGame_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionGameSignal"
  ADD CONSTRAINT "SessionGameSignal_sessionGameId_fkey"
  FOREIGN KEY ("sessionGameId") REFERENCES "SessionGame"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SessionGameSignal"
  ADD CONSTRAINT "SessionGameSignal_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

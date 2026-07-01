CREATE TYPE "UserGameOwnership" AS ENUM ('UNKNOWN', 'HAVE', 'DONT_HAVE');
CREATE TYPE "UserGameInterest" AS ENUM ('WANT_TO_PLAY', 'NEUTRAL', 'NOT_INTERESTED');
CREATE TYPE "UserGamePlayedStatus" AS ENUM ('UNPLAYED', 'PLAYING', 'PLAYED', 'COMPLETED', 'DROPPED');
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');
CREATE TYPE "CommitmentTier" AS ENUM ('ONE_SESSION', 'UNDER_10_HOURS', 'HOURS_10_TO_30', 'HOURS_30_TO_100', 'HOURS_100_TO_1000', 'HOURS_1000_PLUS', 'ENDLESS');
CREATE TYPE "ChallengeProgressStatus" AS ENUM ('SAVED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "normalizedUsername" TEXT,
  ADD COLUMN "usernameChangedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "favouriteGenres" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "directoryVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_normalizedUsername_key" ON "User"("normalizedUsername");
CREATE INDEX "User_normalizedUsername_idx" ON "User"("normalizedUsername");
CREATE INDEX "User_directoryVisible_normalizedUsername_idx" ON "User"("directoryVisible", "normalizedUsername");

ALTER TABLE "Game"
  ADD COLUMN "onlineMultiplayer" BOOLEAN,
  ADD COLUMN "localMultiplayer" BOOLEAN,
  ADD COLUMN "campaignCoop" BOOLEAN,
  ADD COLUMN "timeToBeatHastilyMinutes" INTEGER,
  ADD COLUMN "timeToBeatNormallyMinutes" INTEGER,
  ADD COLUMN "timeToBeatCompletelyMinutes" INTEGER,
  ADD COLUMN "timeToBeatCount" INTEGER,
  ADD COLUMN "timeToBeatSource" TEXT,
  ADD COLUMN "timeToBeatFetchedAt" TIMESTAMP(3),
  ADD COLUMN "minimumSessionMinutes" INTEGER,
  ADD COLUMN "commitmentTier" "CommitmentTier";

ALTER TABLE "UserGame"
  ADD COLUMN "ownership" "UserGameOwnership" NOT NULL DEFAULT 'HAVE',
  ADD COLUMN "wishlist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "favourite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rating" INTEGER,
  ADD COLUMN "interest" "UserGameInterest" NOT NULL DEFAULT 'NEUTRAL',
  ADD COLUMN "playedStatus" "UserGamePlayedStatus" NOT NULL DEFAULT 'UNPLAYED',
  ADD COLUMN "notes" TEXT;

CREATE TABLE "UsernameHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "normalizedUsername" TEXT NOT NULL,
  "reservedUntil" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsernameHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsernameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UsernameHistory_normalizedUsername_key" ON "UsernameHistory"("normalizedUsername");
CREATE INDEX "UsernameHistory_userId_idx" ON "UsernameHistory"("userId");
CREATE INDEX "UsernameHistory_reservedUntil_idx" ON "UsernameHistory"("reservedUntil");

CREATE TABLE "GameCapability" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "minPlayers" INTEGER,
  "maxPlayers" INTEGER,
  "onlineMultiplayer" BOOLEAN,
  "localMultiplayer" BOOLEAN,
  "onlineCoop" BOOLEAN,
  "localCoop" BOOLEAN,
  "campaignCoop" BOOLEAN,
  "source" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameCapability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GameCapability_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GameCapability_gameId_platform_source_key" ON "GameCapability"("gameId", "platform", "source");
CREATE INDEX "GameCapability_gameId_platform_idx" ON "GameCapability"("gameId", "platform");

CREATE TABLE "FriendRequest" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FriendRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FriendRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendRequest_senderId_recipientId_key" ON "FriendRequest"("senderId", "recipientId");
CREATE INDEX "FriendRequest_recipientId_status_idx" ON "FriendRequest"("recipientId", "status");
CREATE INDEX "FriendRequest_senderId_status_idx" ON "FriendRequest"("senderId", "status");

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE TABLE "AccountMergeIntent" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "currentUserId" TEXT NOT NULL,
  "otherUserId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountMergeIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountMergeIntent_currentUserId_fkey" FOREIGN KEY ("currentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccountMergeIntent_otherUserId_fkey" FOREIGN KEY ("otherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountMergeIntent_tokenHash_key" ON "AccountMergeIntent"("tokenHash");
CREATE INDEX "AccountMergeIntent_currentUserId_expiresAt_idx" ON "AccountMergeIntent"("currentUserId", "expiresAt");
CREATE INDEX "AccountMergeIntent_otherUserId_idx" ON "AccountMergeIntent"("otherUserId");

CREATE TABLE "GameChallenge" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "difficulty" INTEGER NOT NULL,
  "minPlayers" INTEGER NOT NULL,
  "maxPlayers" INTEGER NOT NULL,
  "platform" TEXT NOT NULL,
  "estimatedMinMinutes" INTEGER,
  "estimatedMaxMinutes" INTEGER,
  "caveat" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GameChallenge_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "GameChallenge_gameId_idx" ON "GameChallenge"("gameId");
CREATE INDEX "GameChallenge_difficulty_minPlayers_maxPlayers_idx" ON "GameChallenge"("difficulty", "minPlayers", "maxPlayers");

CREATE TABLE "UserChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "status" "ChallengeProgressStatus" NOT NULL DEFAULT 'SAVED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "GameChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserChallenge_userId_challengeId_key" ON "UserChallenge"("userId", "challengeId");
CREATE INDEX "UserChallenge_challengeId_status_idx" ON "UserChallenge"("challengeId", "status");

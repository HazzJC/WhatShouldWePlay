DO $$
BEGIN
  CREATE TYPE "PriceAlertType" AS ENUM ('UNDER_PRICE', 'GROUP_ON_SALE', 'MISSING_PLAYERS_ONLY', 'HISTORICAL_LOW', 'OWNED_COUNT_DISCOUNTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "dealCountry" TEXT NOT NULL DEFAULT 'GB',
  ADD COLUMN IF NOT EXISTS "dealCurrency" TEXT NOT NULL DEFAULT 'GBP';

ALTER TABLE "Participant"
  ADD COLUMN IF NOT EXISTS "preferenceNudgeDismissedAt" TIMESTAMP(3);

ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "itadId" TEXT,
  ADD COLUMN IF NOT EXISTS "steamReviewScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "steamReviewPercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "steamReviewTotal" INTEGER,
  ADD COLUMN IF NOT EXISTS "steamReviewSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "qualitySource" TEXT,
  ADD COLUMN IF NOT EXISTS "qualityFetchedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Game_slug_key" ON "Game"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Game_itadId_key" ON "Game"("itadId");

CREATE TABLE IF NOT EXISTS "GameDeal" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "itadId" TEXT,
  "currentPrice" INTEGER,
  "regularPrice" INTEGER,
  "discountPercent" INTEGER,
  "currency" TEXT,
  "country" TEXT,
  "shopName" TEXT,
  "dealUrl" TEXT,
  "historicalLow" INTEGER,
  "historicalLow3m" INTEGER,
  "historicalLow1y" INTEGER,
  "status" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FriendInvite" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FriendInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserFriend" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFriend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceAlertRule" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "createdByParticipantId" TEXT,
  "type" "PriceAlertType" NOT NULL,
  "thresholdPrice" INTEGER,
  "ownedCount" INTEGER,
  "totalCount" INTEGER,
  "missingOnly" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceAlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PriceAlertEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "ruleId" TEXT,
  "gameId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "currentPrice" INTEGER,
  "historicalLow" INTEGER,
  "currency" TEXT,
  "url" TEXT,
  "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceAlertEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameDeal_gameId_key" ON "GameDeal"("gameId");
CREATE INDEX IF NOT EXISTS "GameDeal_itadId_idx" ON "GameDeal"("itadId");
CREATE INDEX IF NOT EXISTS "GameDeal_fetchedAt_idx" ON "GameDeal"("fetchedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FriendInvite_token_key" ON "FriendInvite"("token");
CREATE INDEX IF NOT EXISTS "FriendInvite_inviterId_idx" ON "FriendInvite"("inviterId");
CREATE INDEX IF NOT EXISTS "FriendInvite_acceptedById_idx" ON "FriendInvite"("acceptedById");
CREATE INDEX IF NOT EXISTS "FriendInvite_expiresAt_idx" ON "FriendInvite"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "UserFriend_userId_friendId_key" ON "UserFriend"("userId", "friendId");
CREATE INDEX IF NOT EXISTS "UserFriend_friendId_idx" ON "UserFriend"("friendId");

CREATE INDEX IF NOT EXISTS "PriceAlertRule_sessionId_idx" ON "PriceAlertRule"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceAlertEvent_sessionId_gameId_message_key" ON "PriceAlertEvent"("sessionId", "gameId", "message");
CREATE INDEX IF NOT EXISTS "PriceAlertEvent_sessionId_idx" ON "PriceAlertEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "PriceAlertEvent_ruleId_idx" ON "PriceAlertEvent"("ruleId");

CREATE TYPE "PriceAlertType" AS ENUM ('UNDER_PRICE', 'GROUP_ON_SALE', 'MISSING_PLAYERS_ONLY', 'HISTORICAL_LOW', 'OWNED_COUNT_DISCOUNTED');

ALTER TABLE "Session"
  ADD COLUMN "dealCountry" TEXT NOT NULL DEFAULT 'GB',
  ADD COLUMN "dealCurrency" TEXT NOT NULL DEFAULT 'GBP';

ALTER TABLE "Participant"
  ADD COLUMN "preferenceNudgeDismissedAt" TIMESTAMP(3);

ALTER TABLE "Game"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "itadId" TEXT;

CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");
CREATE UNIQUE INDEX "Game_itadId_key" ON "Game"("itadId");

CREATE TABLE "GameDeal" (
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

CREATE TABLE "FriendInvite" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "acceptedById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FriendInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserFriend" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserFriend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceAlertRule" (
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

CREATE TABLE "PriceAlertEvent" (
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

CREATE UNIQUE INDEX "GameDeal_gameId_key" ON "GameDeal"("gameId");
CREATE INDEX "GameDeal_itadId_idx" ON "GameDeal"("itadId");
CREATE INDEX "GameDeal_fetchedAt_idx" ON "GameDeal"("fetchedAt");

CREATE UNIQUE INDEX "FriendInvite_token_key" ON "FriendInvite"("token");
CREATE INDEX "FriendInvite_inviterId_idx" ON "FriendInvite"("inviterId");
CREATE INDEX "FriendInvite_acceptedById_idx" ON "FriendInvite"("acceptedById");
CREATE INDEX "FriendInvite_expiresAt_idx" ON "FriendInvite"("expiresAt");

CREATE UNIQUE INDEX "UserFriend_userId_friendId_key" ON "UserFriend"("userId", "friendId");
CREATE INDEX "UserFriend_friendId_idx" ON "UserFriend"("friendId");

CREATE INDEX "PriceAlertRule_sessionId_idx" ON "PriceAlertRule"("sessionId");
CREATE UNIQUE INDEX "PriceAlertEvent_sessionId_gameId_message_key" ON "PriceAlertEvent"("sessionId", "gameId", "message");
CREATE INDEX "PriceAlertEvent_sessionId_idx" ON "PriceAlertEvent"("sessionId");
CREATE INDEX "PriceAlertEvent_ruleId_idx" ON "PriceAlertEvent"("ruleId");

ALTER TABLE "GameDeal"
  ADD CONSTRAINT "GameDeal_gameId_fkey"
  FOREIGN KEY ("gameId") REFERENCES "Game"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FriendInvite"
  ADD CONSTRAINT "FriendInvite_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFriend"
  ADD CONSTRAINT "UserFriend_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFriend"
  ADD CONSTRAINT "UserFriend_friendId_fkey"
  FOREIGN KEY ("friendId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceAlertRule"
  ADD CONSTRAINT "PriceAlertRule_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceAlertEvent"
  ADD CONSTRAINT "PriceAlertEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriceAlertEvent"
  ADD CONSTRAINT "PriceAlertEvent_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "PriceAlertRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

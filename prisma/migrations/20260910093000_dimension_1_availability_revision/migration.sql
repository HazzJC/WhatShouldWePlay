ALTER TABLE "Participant"
ADD COLUMN "availabilityRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Participant"
ADD COLUMN "historyVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "DiscordHostHandoff" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordHostHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordHostHandoff_tokenHash_key" ON "DiscordHostHandoff"("tokenHash");
CREATE INDEX "DiscordHostHandoff_discordUserId_expiresAt_idx" ON "DiscordHostHandoff"("discordUserId", "expiresAt");
CREATE INDEX "DiscordHostHandoff_sessionId_participantId_idx" ON "DiscordHostHandoff"("sessionId", "participantId");
ALTER TABLE "DiscordHostHandoff" ADD CONSTRAINT "DiscordHostHandoff_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordHostHandoff" ADD CONSTRAINT "DiscordHostHandoff_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

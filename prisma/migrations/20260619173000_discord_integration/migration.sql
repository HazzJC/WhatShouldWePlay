ALTER TABLE "Participant"
  ADD COLUMN "discordUserId" TEXT,
  ADD COLUMN "discordUsername" TEXT;

CREATE TABLE "DiscordIntegration" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "channelName" TEXT,
  "createdByUserId" TEXT,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordNotificationLog" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "guildId" TEXT,
  "channelId" TEXT,
  "type" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "messageId" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscordNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordAttendance" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT,
  "discordUserId" TEXT NOT NULL,
  "discordUsername" TEXT,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Participant_sessionId_discordUserId_key" ON "Participant"("sessionId", "discordUserId");
CREATE UNIQUE INDEX "DiscordIntegration_sessionId_guildId_channelId_key" ON "DiscordIntegration"("sessionId", "guildId", "channelId");
CREATE INDEX "DiscordIntegration_guildId_channelId_idx" ON "DiscordIntegration"("guildId", "channelId");
CREATE UNIQUE INDEX "DiscordNotificationLog_sessionId_type_scheduledFor_key" ON "DiscordNotificationLog"("sessionId", "type", "scheduledFor");
CREATE INDEX "DiscordNotificationLog_sessionId_type_idx" ON "DiscordNotificationLog"("sessionId", "type");
CREATE INDEX "DiscordNotificationLog_scheduledFor_status_idx" ON "DiscordNotificationLog"("scheduledFor", "status");
CREATE UNIQUE INDEX "DiscordAttendance_sessionId_discordUserId_key" ON "DiscordAttendance"("sessionId", "discordUserId");
CREATE INDEX "DiscordAttendance_participantId_idx" ON "DiscordAttendance"("participantId");

ALTER TABLE "DiscordIntegration"
  ADD CONSTRAINT "DiscordIntegration_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscordNotificationLog"
  ADD CONSTRAINT "DiscordNotificationLog_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscordAttendance"
  ADD CONSTRAINT "DiscordAttendance_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiscordAttendance"
  ADD CONSTRAINT "DiscordAttendance_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

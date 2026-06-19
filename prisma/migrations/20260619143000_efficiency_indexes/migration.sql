CREATE INDEX IF NOT EXISTS "Participant_sessionId_userId_idx" ON "Participant"("sessionId", "userId");
CREATE INDEX IF NOT EXISTS "UserGame_userId_recentlyPlayedAt_playtimeMinutes_idx" ON "UserGame"("userId", "recentlyPlayedAt", "playtimeMinutes");
CREATE INDEX IF NOT EXISTS "GameDeal_country_fetchedAt_status_idx" ON "GameDeal"("country", "fetchedAt", "status");
CREATE INDEX IF NOT EXISTS "PriceAlertRule_sessionId_enabled_idx" ON "PriceAlertRule"("sessionId", "enabled");

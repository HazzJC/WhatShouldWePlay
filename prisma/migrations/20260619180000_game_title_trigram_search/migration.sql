-- Enable trigram matching so substring / fuzzy title search on
-- Game.normalizedTitle is served by a GIN index instead of a sequential scan.
-- The existing btree index on normalizedTitle is kept for exact-equality lookups
-- (e.g. upsertGame's dedup), which it serves better than a GIN index.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "Game_normalizedTitle_trgm_idx"
  ON "Game" USING GIN ("normalizedTitle" gin_trgm_ops);

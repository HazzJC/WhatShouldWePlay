// Applies pending Prisma migrations as part of the build/deploy.
//
// This is what keeps the deployed database in sync with the schema: whenever a
// feature adds a column and a migration, the next deploy applies it instead of
// leaving production drifting (which surfaces as P2022 "column does not exist"
// errors at runtime).
//
// `prisma migrate deploy` is idempotent — it only applies migrations that have
// not run yet, and is a no-op when the database is already up to date.
//
// When no database is configured (e.g. a local `npm run build` with no DB, or a
// CI typecheck), it skips rather than failing, so the build still works offline.
import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn("[migrate-deploy] DATABASE_URL is not set — skipping prisma migrate deploy.");
  process.exit(0);
}

// Migrations need a direct (non-pooled) connection — pgbouncer (e.g. Neon's
// pooled endpoint) does not support the advisory locks Prisma uses. If DIRECT_URL
// is provided, run the migration against it; otherwise fall back to DATABASE_URL
// (correct for a direct/local connection). This keeps a single source of truth
// without requiring a `directUrl` in the schema.
const migrationDatabaseUrl = process.env.DIRECT_URL || databaseUrl;

console.log("[migrate-deploy] Applying pending migrations…");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: migrationDatabaseUrl },
});

if (result.status !== 0) {
  console.error("[migrate-deploy] prisma migrate deploy failed.");
  process.exit(result.status ?? 1);
}

console.log("[migrate-deploy] Database is up to date.");

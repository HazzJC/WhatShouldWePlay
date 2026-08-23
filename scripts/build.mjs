import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "generate"]);

// Production Vercel builds are the final release boundary. Apply migrations
// before compiling so a failed migration cannot be promoted to production.
// Preview and local builds remain read-only against their databases.
if (process.env.VERCEL_ENV === "production") {
  run("node", ["scripts/migrate-deploy.mjs"]);
}

run("npx", ["next", "build"]);

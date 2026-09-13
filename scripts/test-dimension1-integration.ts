import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

function loadLocalDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    try {
      loadEnvFile(".env");
    } catch {
      // Fall through to the BOM-compatible parser below.
    }
    if (!process.env.DATABASE_URL) {
      const source = readFileSync(".env", "utf8").replace(/^\uFEFF/, "");
      const line = source.split(/\r?\n/).find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
      if (line) process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the isolated integration suite.");
  const url = new URL(process.env.DATABASE_URL);
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) {
    throw new Error(`Refusing integration target ${url.hostname}; only local PostgreSQL is allowed.`);
  }
  return url;
}

async function main() {
  const baseUrl = loadLocalDatabaseUrl();
  const databaseName = `wsplay_dimension1_test_${process.pid}_${Date.now()}`;
  if (!/^wsplay_dimension1_test_[0-9_]+$/.test(databaseName)) throw new Error("Unsafe integration database name.");

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.set("schema", "public");
  const testUrl = new URL(baseUrl);
  testUrl.pathname = `/${databaseName}`;
  testUrl.searchParams.set("schema", "public");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  let prisma: PrismaClient | null = null;
  let appPrisma: PrismaClient | null = null;

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    const migration = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: testUrl.toString() },
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (migration.status !== 0) {
      throw new Error(`Isolated migration failed.\n${migration.error?.message ?? ""}\n${migration.stdout ?? ""}\n${migration.stderr ?? ""}`);
    }

    prisma = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
    const user = await prisma.user.create({ data: { displayName: "Dimension 1 fixture" } });
    const session = await prisma.session.create({
      data: {
        shareToken: `integration-${Date.now()}`,
        title: "Dimension 1 isolated fixture",
        mode: "ONLINE",
        requiredDuration: 2,
        minimumPlayerCount: 2,
        dateRangeStart: new Date("2026-10-25T00:00:00.000Z"),
        dateRangeEnd: new Date("2026-10-25T00:00:00.000Z"),
        dailyStartHour: 0,
        dailyEndHour: 4,
        timezone: "Europe/London",
        reminderPreferences: [],
        workspaceType: "PLAN",
      },
    });

    const joins = await Promise.allSettled([
      prisma.participant.create({ data: { sessionId: session.id, userId: user.id, name: "Fixture" } }),
      prisma.participant.create({ data: { sessionId: session.id, userId: user.id, name: "Fixture retry" } }),
    ]);
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
    });
    if (joins.filter((result) => result.status === "fulfilled").length !== 1) {
      throw new Error("Concurrent membership uniqueness did not produce exactly one row.");
    }

    const revisions = await Promise.all([
      prisma.participant.updateMany({
        where: { id: participant.id, availabilityRevision: 0 },
        data: { availabilityRevision: { increment: 1 } },
      }),
      prisma.participant.updateMany({
        where: { id: participant.id, availabilityRevision: 0 },
        data: { availabilityRevision: { increment: 1 } },
      }),
    ]);
    if (revisions.reduce((total, result) => total + result.count, 0) !== 1) {
      throw new Error("Availability compare-and-set allowed more than one writer.");
    }

    await prisma.participant.update({ where: { id: participant.id }, data: { historyVisible: false } });
    const hidden = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
    if (hidden.userId !== user.id || hidden.historyVisible) {
      throw new Error("Hiding history changed membership or failed to hide the entry.");
    }

    process.env.DATABASE_URL = testUrl.toString();
    const { createAccountMergeIntent, mergeAccounts } = await import("../src/lib/account-merge");
    appPrisma = (await import("../src/lib/prisma")).prisma;
    const destinationUser = await prisma.user.create({ data: { displayName: "Merge destination" } });
    const sourceUser = await prisma.user.create({ data: { displayName: "Merge source" } });
    const mergeSession = await prisma.session.create({
      data: {
        shareToken: `merge-${Date.now()}`,
        title: "Merge fixture",
        mode: "ONLINE",
        requiredDuration: 2,
        minimumPlayerCount: 2,
        dateRangeStart: new Date("2026-09-11T00:00:00.000Z"),
        dateRangeEnd: new Date("2026-09-11T00:00:00.000Z"),
        dailyStartHour: 18,
        dailyEndHour: 22,
        timezone: "Europe/London",
        reminderPreferences: [],
        participants: {
          create: [
            { name: "Destination", userId: destinationUser.id, isHost: false },
            { name: "Source host", userId: sourceUser.id, isHost: true },
          ],
        },
      },
    });
    const mergeToken = await createAccountMergeIntent(destinationUser.id, sourceUser.id, "GOOGLE");
    await mergeAccounts(destinationUser.id, mergeToken);
    const mergedParticipant = await prisma.participant.findUniqueOrThrow({
      where: { sessionId_userId: { sessionId: mergeSession.id, userId: destinationUser.id } },
    });
    if (!mergedParticipant.isHost) throw new Error("Account merge discarded host authority.");
    await mergeAccounts(destinationUser.id, mergeToken).then(
      () => { throw new Error("Account merge intent was applied twice."); },
      () => undefined,
    );

    console.log(JSON.stringify({
      database: databaseName,
      migrations: "applied",
      concurrentMembershipRows: 1,
      availabilityRevisionWinners: 1,
      hiddenHistoryPreservedMembership: true,
      mergePreservedHost: true,
      mergeIntentSingleUse: true,
    }));
  } finally {
    await appPrisma?.$disconnect();
    await prisma?.$disconnect();
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
    );
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

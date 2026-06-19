import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Cache the client on the global in every environment, including production.
// On Vercel each warm serverless invocation reuses this module, so caching here
// keeps a single PrismaClient (and therefore a single connection pool) per
// instance instead of opening a fresh pool on every request — essential for
// staying within Neon's free-tier connection limits. Point DATABASE_URL at the
// Neon pooled endpoint (`-pooler` host, `?pgbouncer=true&connection_limit=1`).
globalForPrisma.prisma = prisma;

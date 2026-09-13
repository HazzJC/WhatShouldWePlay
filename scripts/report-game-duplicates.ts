import { prisma } from "@/lib/prisma";

async function main() {
const games = await prisma.game.findMany({
  select: {
    id: true,
    title: true,
    normalizedTitle: true,
    slug: true,
    steamAppId: true,
    igdbId: true,
    itadId: true,
  },
  orderBy: [{ normalizedTitle: "asc" }, { id: "asc" }],
});

const byTitle = new Map<string, typeof games>();
for (const game of games) {
  const group = byTitle.get(game.normalizedTitle) ?? [];
  group.push(game);
  byTitle.set(game.normalizedTitle, group);
}

const possibleDuplicates = [...byTitle.entries()]
  .filter(([, group]) => group.length > 1)
  .map(([normalizedTitle, group]) => ({ normalizedTitle, games: group }));

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  gameCount: games.length,
  possibleDuplicateTitleGroups: possibleDuplicates.length,
  note: "Title equality is advisory only. Merge only when stable provider identity or reviewed edition evidence proves equivalence.",
  possibleDuplicates,
}, null, 2));

await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

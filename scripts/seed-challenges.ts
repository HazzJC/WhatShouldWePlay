import { PrismaClient } from "@prisma/client";
import { curatedChallenges } from "../src/lib/challenges";

const prisma = new PrismaClient();

async function main() {
  for (const definition of curatedChallenges) {
    const normalizedTitle = definition.game.title.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const game = definition.game.steamAppId
      ? await prisma.game.upsert({
          where: { steamAppId: definition.game.steamAppId },
          create: {
            title: definition.game.title,
            normalizedTitle,
            steamAppId: definition.game.steamAppId,
          },
          update: {
            title: definition.game.title,
            normalizedTitle,
          },
        })
      : (await prisma.game.findFirst({ where: { normalizedTitle } })) ??
        (await prisma.game.create({
          data: {
            title: definition.game.title,
            normalizedTitle,
          },
        }));

    await prisma.gameChallenge.upsert({
      where: { id: definition.id },
      create: {
        id: definition.id,
        gameId: game.id,
        title: definition.title,
        description: definition.description,
        difficulty: definition.difficulty,
        minPlayers: definition.minPlayers,
        maxPlayers: definition.maxPlayers,
        platform: definition.platform,
        estimatedMinMinutes: definition.estimatedMinMinutes,
        estimatedMaxMinutes: definition.estimatedMaxMinutes,
        caveat: definition.caveat,
        sourceName: definition.sourceName,
        sourceUrl: definition.sourceUrl,
        verifiedAt: new Date(definition.verifiedAt),
      },
      update: {
        gameId: game.id,
        title: definition.title,
        description: definition.description,
        difficulty: definition.difficulty,
        minPlayers: definition.minPlayers,
        maxPlayers: definition.maxPlayers,
        platform: definition.platform,
        estimatedMinMinutes: definition.estimatedMinMinutes,
        estimatedMaxMinutes: definition.estimatedMaxMinutes,
        caveat: definition.caveat,
        sourceName: definition.sourceName,
        sourceUrl: definition.sourceUrl,
        verifiedAt: new Date(definition.verifiedAt),
      },
    });
  }

  console.info(`[challenge-seed] Upserted ${curatedChallenges.length} challenges.`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

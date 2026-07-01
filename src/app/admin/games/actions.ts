"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMetadataAdmin } from "@/lib/admin";
import { parsePlayerMetadataCsv } from "@/lib/player-metadata-csv";
import { prisma } from "@/lib/prisma";

const playerCountSchema = z.object({
  gameId: z.string().min(1),
  minPlayers: z.coerce.number().int().min(1).max(1000),
  maxPlayers: z.coerce.number().int().min(1).max(1000),
  returnTo: z.string().startsWith("/admin/games").default("/admin/games"),
}).refine((value) => value.maxPlayers >= value.minPlayers, {
  message: "Maximum players must be at least the minimum.",
});

export async function saveGamePlayerCountAction(formData: FormData) {
  await requireMetadataAdmin();

  const parsed = playerCountSchema.safeParse({
    gameId: formData.get("gameId"),
    minPlayers: formData.get("minPlayers"),
    maxPlayers: formData.get("maxPlayers"),
    returnTo: formData.get("returnTo") || "/admin/games",
  });

  if (!parsed.success) {
    const returnTo = String(formData.get("returnTo") || "/admin/games");
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid player count.")}`);
  }

  const { gameId, minPlayers, maxPlayers, returnTo } = parsed.data;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true },
  });

  if (!game) {
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}error=${encodeURIComponent("Game not found.")}`);
  }

  await prisma.$transaction([
    prisma.game.update({
      where: { id: gameId },
      data: {
        minPlayers,
        maxPlayers,
        capabilitySource: "admin:hazzjc",
        capabilityConfidence: 1,
      },
    }),
    prisma.gameCapability.upsert({
      where: {
        gameId_platform_source: {
          gameId,
          platform: "All",
          source: "admin:hazzjc",
        },
      },
      create: {
        gameId,
        platform: "All",
        minPlayers,
        maxPlayers,
        source: "admin:hazzjc",
        confidence: 1,
      },
      update: {
        minPlayers,
        maxPlayers,
        confidence: 1,
        fetchedAt: new Date(),
      },
    }),
  ]);

  revalidatePath("/admin/games");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=${encodeURIComponent(gameId)}`);
}

export async function importGamePlayerCountsAction(formData: FormData) {
  await requireMetadataAdmin();
  const file = formData.get("metadata");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/games?error=Choose+a+CSV+file+to+upload.");
  }

  if (file.size > 750 * 1024) {
    redirect("/admin/games?error=CSV+files+must+be+750+KB+or+smaller.");
  }

  const result = parsePlayerMetadataCsv(await file.text());

  if (result.errors.length > 0) {
    redirect(`/admin/games?error=${encodeURIComponent(`${result.errors[0]} Fix the CSV and upload it again. No rows were saved.`)}`);
  }

  if (result.updates.length === 0) {
    redirect(`/admin/games?error=${encodeURIComponent("No completed player-count rows were found.")}`);
  }

  const importedGames = await prisma.game.findMany({
    where: {
      id: { in: result.updates.map((update) => update.gameId) },
      userGames: { some: { source: "STEAM" } },
    },
    select: { id: true },
  });
  const importedGameIds = new Set(importedGames.map((game) => game.id));
  const validUpdates = result.updates.filter((update) => importedGameIds.has(update.gameId));
  const unknownCount = result.updates.length - validUpdates.length;

  for (let index = 0; index < validUpdates.length; index += 100) {
    const batch = validUpdates.slice(index, index + 100);
    await prisma.$transaction(
      batch.flatMap((update) => [
        prisma.game.update({
          where: { id: update.gameId },
          data: {
            minPlayers: update.minPlayers,
            maxPlayers: update.maxPlayers,
            capabilitySource: "admin:hazzjc",
            capabilityConfidence: 1,
          },
        }),
        prisma.gameCapability.upsert({
          where: {
            gameId_platform_source: {
              gameId: update.gameId,
              platform: "All",
              source: "admin:hazzjc",
            },
          },
          create: {
            gameId: update.gameId,
            platform: "All",
            minPlayers: update.minPlayers,
            maxPlayers: update.maxPlayers,
            source: "admin:hazzjc",
            confidence: 1,
          },
          update: {
            minPlayers: update.minPlayers,
            maxPlayers: update.maxPlayers,
            confidence: 1,
            fetchedAt: new Date(),
          },
        }),
      ]),
    );
  }

  revalidatePath("/admin/games");
  redirect(`/admin/games?imported=${validUpdates.length}&skipped=${result.skipped + unknownCount}`);
}

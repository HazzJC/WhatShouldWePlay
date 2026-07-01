"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMetadataAdmin } from "@/lib/admin";
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

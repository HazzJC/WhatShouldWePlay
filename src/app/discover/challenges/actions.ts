"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { curatedChallenges } from "@/lib/challenges";
import { normalizeGameTitle } from "@/lib/games";
import { prisma } from "@/lib/prisma";

const challengeProgressSchema = z.object({
  challengeId: z.string().min(1),
  status: z.enum(["SAVED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]),
});

export async function updateChallengeProgressAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user?.username) {
    redirect("/account?returnTo=%2Fdiscover%2Fchallenges");
  }

  const parsed = challengeProgressSchema.safeParse({
    challengeId: formData.get("challengeId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    throw new Error("Could not update challenge.");
  }

  const definition = curatedChallenges.find((challenge) => challenge.id === parsed.data.challengeId);

  if (!definition) {
    throw new Error("Challenge not found.");
  }

  const game = definition.game.steamAppId
    ? await prisma.game.upsert({
        where: { steamAppId: definition.game.steamAppId },
        create: {
          title: definition.game.title,
          normalizedTitle: normalizeGameTitle(definition.game.title),
          steamAppId: definition.game.steamAppId,
        },
        update: {
          title: definition.game.title,
          normalizedTitle: normalizeGameTitle(definition.game.title),
        },
      })
    : (await prisma.game.findFirst({
        where: { normalizedTitle: normalizeGameTitle(definition.game.title) },
      })) ??
      (await prisma.game.create({
        data: {
          title: definition.game.title,
          normalizedTitle: normalizeGameTitle(definition.game.title),
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

  const now = new Date();
  await prisma.userChallenge.upsert({
    where: {
      userId_challengeId: {
        userId: user.id,
        challengeId: definition.id,
      },
    },
    create: {
      userId: user.id,
      challengeId: definition.id,
      status: parsed.data.status,
      startedAt: parsed.data.status === "IN_PROGRESS" ? now : null,
      completedAt: parsed.data.status === "COMPLETED" ? now : null,
    },
    update: {
      status: parsed.data.status,
      startedAt: parsed.data.status === "IN_PROGRESS" ? now : undefined,
      completedAt: parsed.data.status === "COMPLETED" ? now : null,
    },
  });

  revalidatePath("/discover/challenges");
}

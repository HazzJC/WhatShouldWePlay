"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearUserSession, getCurrentUser, safeInternalRedirect } from "@/lib/auth";
import {
  normalizeUsername,
  usernameChangeAvailableAt,
  validateUsername,
} from "@/lib/accounts";
import { importSteamGamesForUser, normalizeGameTitle } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { getOwnedSteamGames, getRecentlyPlayedSteamGames } from "@/lib/steam";
import { mergeAccounts } from "@/lib/account-merge";
import { validateAvatarFile } from "@/lib/avatar";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  favouriteGenres: z.string().trim().max(300).optional(),
  directoryVisible: z.enum(["true", "false"]).default("true"),
});

export async function saveUsernameAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const result = validateUsername(String(formData.get("username") ?? ""));
  const returnTo = safeInternalRedirect(String(formData.get("returnTo") ?? "/account"));

  if (!result.success) {
    redirect(`/account/onboarding?error=${encodeURIComponent(result.error)}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  const changingUsername = Boolean(
    currentUser.normalizedUsername &&
      currentUser.normalizedUsername !== result.username,
  );
  const availableAt = usernameChangeAvailableAt(currentUser.usernameChangedAt);

  if (changingUsername && availableAt && availableAt > new Date()) {
    redirect(
      `/account/onboarding?error=${encodeURIComponent(
        `You can change your username again after ${availableAt.toLocaleDateString("en-GB")}.`,
      )}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  const reserved = await prisma.usernameHistory.findUnique({
    where: { normalizedUsername: result.username },
  });

  if (reserved && reserved.userId !== currentUser.id && reserved.reservedUntil > new Date()) {
    redirect(`/account/onboarding?error=${encodeURIComponent("That username is reserved.")}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  try {
    await prisma.$transaction(async (transaction) => {
      if (changingUsername && currentUser.normalizedUsername) {
        await transaction.usernameHistory.upsert({
          where: { normalizedUsername: currentUser.normalizedUsername },
          create: {
            userId: currentUser.id,
            normalizedUsername: currentUser.normalizedUsername,
            reservedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            userId: currentUser.id,
            reservedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await transaction.user.update({
        where: { id: currentUser.id },
        data: {
          username: result.username,
          normalizedUsername: result.username,
          usernameChangedAt: changingUsername || !currentUser.username ? new Date() : currentUser.usernameChangedAt,
          onboardingCompletedAt: currentUser.onboardingCompletedAt ?? new Date(),
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/account/onboarding?error=${encodeURIComponent("That username is already taken.")}&returnTo=${encodeURIComponent(returnTo)}`);
    }

    throw error;
  }

  redirect(returnTo);
}

export async function updateAccountProfileAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    favouriteGenres: formData.get("favouriteGenres") || undefined,
    directoryVisible: formData.get("directoryVisible") ? "true" : "false",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update profile.");
  }

  const favouriteGenres = (parsed.data.favouriteGenres ?? "")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, 12);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      displayName: parsed.data.displayName,
      favouriteGenres,
      directoryVisible: parsed.data.directoryVisible === "true",
    },
  });

  revalidatePath("/account");
}

export async function uploadProfileAvatarAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    redirect("/account?avatar_error=Choose+an+image+to+upload.");
  }

  const validation = await validateAvatarFile(file);

  if (!validation.success) {
    redirect(`/account?avatar_error=${encodeURIComponent(validation.error)}`);
  }

  const version = Date.now();
  await prisma.$transaction([
    prisma.userAvatar.upsert({
      where: { userId: currentUser.id },
      create: {
        userId: currentUser.id,
        data: validation.data,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
      },
      update: {
        data: validation.data,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
      },
    }),
    prisma.user.update({
      where: { id: currentUser.id },
      data: { avatarUrl: `/api/users/${currentUser.id}/avatar?v=${version}` },
    }),
  ]);

  revalidatePath("/account");
  redirect("/account?avatar=updated");
}

export async function removeProfileAvatarAction() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const providerAvatar =
    currentUser.oauthAccounts.find((account) => account.avatarUrl)?.avatarUrl ??
    currentUser.steamAccount?.avatarUrl ??
    null;

  await prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId: currentUser.id } }),
    prisma.user.update({
      where: { id: currentUser.id },
      data: { avatarUrl: providerAvatar },
    }),
  ]);

  revalidatePath("/account");
  redirect("/account?avatar=removed");
}

export async function removeRecentSessionAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const participantId = String(formData.get("participantId") ?? "");
  const participant = await prisma.participant.findFirst({
    where: {
      id: participantId,
      userId: currentUser.id,
    },
    select: {
      id: true,
      sessionId: true,
      isHost: true,
    },
  });

  if (!participant) {
    throw new Error("Session membership not found.");
  }

  if (participant.isHost) {
    await prisma.session.delete({ where: { id: participant.sessionId } });
  } else {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { userId: null },
    });
  }

  revalidatePath("/account");
}

const libraryGameSchema = z.object({
  gameId: z.string().min(1),
  ownership: z.enum(["UNKNOWN", "HAVE", "DONT_HAVE"]),
  wishlist: z.enum(["true", "false"]).default("false"),
  favourite: z.enum(["true", "false"]).default("false"),
  rating: z.coerce.number().int().min(1).max(10).optional(),
  interest: z.enum(["WANT_TO_PLAY", "NEUTRAL", "NOT_INTERESTED"]).default("NEUTRAL"),
  playedStatus: z.enum(["UNPLAYED", "PLAYING", "PLAYED", "COMPLETED", "DROPPED"]).default("UNPLAYED"),
  notes: z.string().trim().max(1000).optional(),
});

export async function updateLibraryGameAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser?.username) {
    redirect("/account");
  }

  const parsed = libraryGameSchema.safeParse({
    gameId: formData.get("gameId"),
    ownership: formData.get("ownership"),
    wishlist: formData.get("wishlist") ? "true" : "false",
    favourite: formData.get("favourite") ? "true" : "false",
    rating: formData.get("rating") || undefined,
    interest: formData.get("interest") || "NEUTRAL",
    playedStatus: formData.get("playedStatus") || "UNPLAYED",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Could not update game.");
  }

  const { gameId, wishlist, favourite, ...profile } = parsed.data;
  const data = {
    ...profile,
    wishlist: wishlist === "true",
    favourite: favourite === "true",
  };

  await prisma.userGame.upsert({
    where: {
      userId_gameId: {
        userId: currentUser.id,
        gameId,
      },
    },
    create: {
      userId: currentUser.id,
      gameId,
      source: "MANUAL",
      ...data,
    },
    update: data,
  });

  revalidatePath("/account/library");
}

export async function addLibraryGameAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser?.username) {
    redirect("/account");
  }

  const title = String(formData.get("title") ?? "").trim();

  if (!title || title.length > 180) {
    throw new Error("Enter a valid game title.");
  }

  const normalizedTitle = normalizeGameTitle(title);
  const game =
    (await prisma.game.findFirst({ where: { normalizedTitle } })) ??
    (await prisma.game.create({
      data: {
        title,
        normalizedTitle,
      },
    }));

  await prisma.userGame.upsert({
    where: { userId_gameId: { userId: currentUser.id, gameId: game.id } },
    create: {
      userId: currentUser.id,
      gameId: game.id,
      source: "MANUAL",
      ownership: "HAVE",
    },
    update: {
      ownership: "HAVE",
    },
  });

  redirect("/account/library");
}

export async function importAccountSteamLibraryAction() {
  const currentUser = await getCurrentUser();

  if (!currentUser?.username || !currentUser.steamAccount) {
    redirect("/account");
  }

  const [owned, recent] = await Promise.all([
    getOwnedSteamGames(currentUser.steamAccount.steamId),
    getRecentlyPlayedSteamGames(currentUser.steamAccount.steamId),
  ]);

  await importSteamGamesForUser(currentUser.id, owned.games, recent);
  await prisma.steamAccount.update({
    where: { userId: currentUser.id },
    data: {
      lastImportAt: new Date(),
      lastImportStatus: owned.status,
    },
  });

  revalidatePath("/account/library");
  redirect(`/account/library?imported=${owned.games.length}`);
}

export async function deleteAccountAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/");
  }

  const confirmation = normalizeUsername(String(formData.get("confirmation") ?? ""));

  if (!currentUser.normalizedUsername || confirmation !== currentUser.normalizedUsername) {
    throw new Error("Type your username exactly to delete the account.");
  }

  await clearUserSession();
  await prisma.user.delete({ where: { id: currentUser.id } });
  redirect("/?account=deleted");
}

export async function confirmAccountMergeAction(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/account");
  }

  const token = String(formData.get("token") ?? "");

  if (!token) {
    throw new Error("Merge confirmation is missing.");
  }

  await mergeAccounts(currentUser.id, token);
  revalidatePath("/account");
  redirect("/account?merged=true");
}

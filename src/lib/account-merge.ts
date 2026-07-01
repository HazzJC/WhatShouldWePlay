import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createAccountMergeIntent(
  currentUserId: string,
  otherUserId: string,
  provider: "GOOGLE" | "STEAM",
) {
  const token = randomBytes(32).toString("base64url");
  await prisma.accountMergeIntent.create({
    data: {
      tokenHash: hashSessionToken(token),
      currentUserId,
      otherUserId,
      provider,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return token;
}

export async function mergeAccounts(currentUserId: string, token: string) {
  const intent = await prisma.accountMergeIntent.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      currentUserId,
      expiresAt: { gt: new Date() },
      confirmedAt: null,
    },
  });

  if (!intent || intent.currentUserId === intent.otherUserId) {
    throw new Error("This merge request is invalid or has expired.");
  }

  await prisma.$transaction(async (transaction) => {
    const [current, other, currentGames, otherGames] = await Promise.all([
      transaction.user.findUniqueOrThrow({
        where: { id: currentUserId },
        include: { steamAccount: true, preference: true },
      }),
      transaction.user.findUniqueOrThrow({
        where: { id: intent.otherUserId },
        include: { steamAccount: true, preference: true },
      }),
      transaction.userGame.findMany({ where: { userId: currentUserId } }),
      transaction.userGame.findMany({ where: { userId: intent.otherUserId } }),
    ]);
    const currentGamesById = new Map(currentGames.map((game) => [game.gameId, game]));

    for (const otherGame of otherGames) {
      const existing = currentGamesById.get(otherGame.gameId);

      await transaction.userGame.upsert({
        where: { userId_gameId: { userId: currentUserId, gameId: otherGame.gameId } },
        create: {
          userId: currentUserId,
          gameId: otherGame.gameId,
          source: otherGame.source,
          ownership: otherGame.ownership,
          wishlist: otherGame.wishlist,
          favourite: otherGame.favourite,
          rating: otherGame.rating,
          interest: otherGame.interest,
          playedStatus: otherGame.playedStatus,
          notes: otherGame.notes,
          playtimeMinutes: otherGame.playtimeMinutes,
          recentlyPlayedAt: otherGame.recentlyPlayedAt,
          lastImportedAt: otherGame.lastImportedAt,
        },
        update: {
          ownership: mergeOwnership(existing?.ownership, otherGame.ownership),
          wishlist: Boolean(existing?.wishlist || otherGame.wishlist),
          favourite: Boolean(existing?.favourite || otherGame.favourite),
          rating: existing?.rating ?? otherGame.rating,
          interest: existing?.interest === "NEUTRAL" ? otherGame.interest : existing?.interest,
          playedStatus: existing?.playedStatus === "UNPLAYED" ? otherGame.playedStatus : existing?.playedStatus,
          notes: existing?.notes ?? otherGame.notes,
          playtimeMinutes: Math.max(existing?.playtimeMinutes ?? 0, otherGame.playtimeMinutes ?? 0),
          recentlyPlayedAt: latestDate(existing?.recentlyPlayedAt, otherGame.recentlyPlayedAt),
          lastImportedAt: latestDate(existing?.lastImportedAt, otherGame.lastImportedAt),
        },
      });
    }

    await mergeFriendships(transaction, currentUserId, intent.otherUserId);
    await mergeGroupMemberships(transaction, currentUserId, intent.otherUserId);
    await mergeChallenges(transaction, currentUserId, intent.otherUserId);

    if (!current.preference && other.preference) {
      await transaction.userPreference.update({
        where: { userId: intent.otherUserId },
        data: { userId: currentUserId },
      });
    }

    if (!current.steamAccount && other.steamAccount) {
      await transaction.steamAccount.update({
        where: { userId: intent.otherUserId },
        data: { userId: currentUserId },
      });
    }

    await transaction.oAuthAccount.updateMany({
      where: { userId: intent.otherUserId },
      data: { userId: currentUserId },
    });
    await transaction.participant.updateMany({
      where: { userId: intent.otherUserId },
      data: { userId: currentUserId },
    });
    await transaction.sessionGame.updateMany({
      where: { addedByUserId: intent.otherUserId },
      data: { addedByUserId: currentUserId },
    });
    await transaction.friendGroup.updateMany({
      where: { ownerId: intent.otherUserId },
      data: { ownerId: currentUserId },
    });
    await transaction.friendInvite.updateMany({
      where: { inviterId: intent.otherUserId },
      data: { inviterId: currentUserId },
    });
    await transaction.friendGroupInvite.updateMany({
      where: { inviterId: intent.otherUserId },
      data: { inviterId: currentUserId },
    });
    await transaction.user.update({
      where: { id: currentUserId },
      data: {
        email: current.email ?? other.email,
        emailVerified: current.emailVerified || other.emailVerified,
        avatarUrl: current.avatarUrl ?? other.avatarUrl,
        favouriteGenres: mergeJsonStringLists(current.favouriteGenres, other.favouriteGenres),
      },
    });
    await transaction.accountMergeIntent.update({
      where: { id: intent.id },
      data: { confirmedAt: new Date() },
    });
    await transaction.user.delete({ where: { id: intent.otherUserId } });
  }, { timeout: 20_000 });
}

async function mergeFriendships(
  transaction: Prisma.TransactionClient,
  currentUserId: string,
  otherUserId: string,
) {
  const friendships = await transaction.userFriend.findMany({
    where: { userId: otherUserId },
  });

  for (const friendship of friendships) {
    if (friendship.friendId === currentUserId) continue;
    await transaction.userFriend.upsert({
      where: { userId_friendId: { userId: currentUserId, friendId: friendship.friendId } },
      create: { userId: currentUserId, friendId: friendship.friendId },
      update: {},
    });
    await transaction.userFriend.upsert({
      where: { userId_friendId: { userId: friendship.friendId, friendId: currentUserId } },
      create: { userId: friendship.friendId, friendId: currentUserId },
      update: {},
    });
  }

  await transaction.userFriend.deleteMany({
    where: {
      OR: [
        { userId: otherUserId },
        { friendId: otherUserId },
      ],
    },
  });
  await transaction.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: otherUserId },
        { recipientId: otherUserId },
      ],
    },
  });
}

async function mergeGroupMemberships(
  transaction: Prisma.TransactionClient,
  currentUserId: string,
  otherUserId: string,
) {
  const memberships = await transaction.friendGroupMember.findMany({
    where: { userId: otherUserId },
  });

  for (const membership of memberships) {
    const existing = await transaction.friendGroupMember.findFirst({
      where: { groupId: membership.groupId, userId: currentUserId },
    });

    if (existing) {
      await transaction.friendGroupMember.delete({ where: { id: membership.id } });
    } else {
      await transaction.friendGroupMember.update({
        where: { id: membership.id },
        data: { userId: currentUserId },
      });
    }
  }
}

async function mergeChallenges(
  transaction: Prisma.TransactionClient,
  currentUserId: string,
  otherUserId: string,
) {
  const progress = await transaction.userChallenge.findMany({ where: { userId: otherUserId } });

  for (const entry of progress) {
    await transaction.userChallenge.upsert({
      where: { userId_challengeId: { userId: currentUserId, challengeId: entry.challengeId } },
      create: {
        userId: currentUserId,
        challengeId: entry.challengeId,
        status: entry.status,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
      },
      update: entry.status === "COMPLETED"
        ? { status: "COMPLETED", completedAt: entry.completedAt }
        : {},
    });
  }
}

function mergeOwnership(current: "UNKNOWN" | "HAVE" | "DONT_HAVE" | undefined, other: "UNKNOWN" | "HAVE" | "DONT_HAVE") {
  if (current === "HAVE" || other === "HAVE") return "HAVE";
  if (current === "DONT_HAVE" || other === "DONT_HAVE") return "DONT_HAVE";
  return "UNKNOWN";
}

function latestDate(first?: Date | null, second?: Date | null) {
  if (!first) return second ?? null;
  if (!second) return first;
  return first > second ? first : second;
}

function mergeJsonStringLists(first: Prisma.JsonValue, second: Prisma.JsonValue) {
  const values = [
    ...(Array.isArray(first) ? first : []),
    ...(Array.isArray(second) ? second : []),
  ].filter((value): value is string => typeof value === "string");
  return [...new Set(values)];
}

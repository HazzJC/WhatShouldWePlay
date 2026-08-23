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
        include: { steamAccount: true, preference: true, avatarImage: true },
      }),
      transaction.user.findUniqueOrThrow({
        where: { id: intent.otherUserId },
        include: { steamAccount: true, preference: true, avatarImage: true },
      }),
      transaction.userGame.findMany({ where: { userId: currentUserId } }),
      transaction.userGame.findMany({ where: { userId: intent.otherUserId } }),
    ]);
    const currentGamesById = new Map(currentGames.map((game) => [game.gameId, game]));

    if (current.steamAccount && other.steamAccount && current.steamAccount.steamId !== other.steamAccount.steamId) {
      throw new Error("Both accounts have different Steam profiles. Disconnect the Steam profile you do not want before merging.");
    }

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
    await mergeBlocks(transaction, currentUserId, intent.otherUserId);
    await mergeParticipants(transaction, currentUserId, intent.otherUserId);

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

    if (!current.avatarImage && other.avatarImage) {
      await transaction.userAvatar.update({
        where: { userId: intent.otherUserId },
        data: { userId: currentUserId },
      });
    }

    await transaction.oAuthAccount.updateMany({
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
    await transaction.gameNight.updateMany({
      where: { ownerUserId: intent.otherUserId },
      data: { ownerUserId: currentUserId, lastActivityAt: new Date() },
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
        avatarUrl: current.avatarUrl ?? rewriteAvatarUrl(other.avatarUrl, intent.otherUserId, currentUserId),
        timezone: current.timezone ?? other.timezone,
        role: current.role === "METADATA_ADMIN" || other.role === "METADATA_ADMIN" ? "METADATA_ADMIN" : "USER",
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

async function mergeParticipants(transaction: Prisma.TransactionClient, currentUserId: string, otherUserId: string) {
  const otherParticipants = await transaction.participant.findMany({
    where: { userId: otherUserId },
    include: { responses: true, gameSignals: true, gameInterests: true, preference: true },
  });

  for (const participant of otherParticipants) {
    const existing = await transaction.participant.findUnique({
      where: { sessionId_userId: { sessionId: participant.sessionId, userId: currentUserId } },
      include: { preference: true },
    });
    if (!existing) {
      await transaction.participant.update({ where: { id: participant.id }, data: { userId: currentUserId } });
      continue;
    }

    for (const response of participant.responses) {
      await transaction.availabilityResponse.upsert({
        where: { participantId_slotStart: { participantId: existing.id, slotStart: response.slotStart } },
        create: { participantId: existing.id, slotStart: response.slotStart, slotEnd: response.slotEnd, status: response.status },
        update: { slotEnd: response.slotEnd, status: response.status },
      });
    }
    for (const signal of participant.gameSignals) {
      await transaction.sessionGameSignal.upsert({
        where: { sessionGameId_participantId: { sessionGameId: signal.sessionGameId, participantId: existing.id } },
        create: { sessionGameId: signal.sessionGameId, participantId: existing.id, signal: signal.signal },
        update: { signal: signal.signal },
      });
    }
    for (const interest of participant.gameInterests) {
      await transaction.sessionGameInterest.upsert({
        where: { sessionGameId_participantId: { sessionGameId: interest.sessionGameId, participantId: existing.id } },
        create: { sessionGameId: interest.sessionGameId, participantId: existing.id, interest: interest.interest },
        update: { interest: interest.interest },
      });
    }
    if (!existing.preference && participant.preference) {
      await transaction.participantPreference.update({
        where: { participantId: participant.id },
        data: { participantId: existing.id },
      });
    }
    await transaction.sessionGame.updateMany({ where: { addedByParticipantId: participant.id }, data: { addedByParticipantId: existing.id } });
    await transaction.discordAttendance.updateMany({ where: { participantId: participant.id }, data: { participantId: existing.id } });
    await transaction.participant.delete({ where: { id: participant.id } });
  }
}

async function mergeBlocks(transaction: Prisma.TransactionClient, currentUserId: string, otherUserId: string) {
  const blocks = await transaction.userBlock.findMany({
    where: { OR: [{ blockerId: otherUserId }, { blockedId: otherUserId }] },
  });
  for (const block of blocks) {
    const blockerId = block.blockerId === otherUserId ? currentUserId : block.blockerId;
    const blockedId = block.blockedId === otherUserId ? currentUserId : block.blockedId;
    if (blockerId !== blockedId) {
      await transaction.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });
    }
  }
  await transaction.userBlock.deleteMany({ where: { OR: [{ blockerId: otherUserId }, { blockedId: otherUserId }] } });
}

function rewriteAvatarUrl(value: string | null, otherUserId: string, currentUserId: string) {
  if (!value) return null;
  return value === `/api/users/${otherUserId}/avatar` ? `/api/users/${currentUserId}/avatar` : value;
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

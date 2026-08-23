import { prisma } from "@/lib/prisma";

export async function cleanupExpiredRecords(now = new Date()) {
  const oldNotification = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [sessions, friendInvites, groupInvites, mergeIntents, usernameHistory, notifications] = await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.friendInvite.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { acceptedAt: { not: null, lte: oldNotification } }] } }),
    prisma.friendGroupInvite.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { acceptedAt: { not: null, lte: oldNotification } }] } }),
    prisma.accountMergeIntent.deleteMany({ where: { OR: [{ expiresAt: { lte: now } }, { confirmedAt: { not: null } }] } }),
    prisma.usernameHistory.deleteMany({ where: { reservedUntil: { lte: now } } }),
    prisma.discordNotificationLog.deleteMany({ where: { createdAt: { lte: oldNotification }, status: "sent" } }),
  ]);
  return {
    userSessions: sessions.count,
    friendInvites: friendInvites.count,
    groupInvites: groupInvites.count,
    mergeIntents: mergeIntents.count,
    usernameHistory: usernameHistory.count,
    notifications: notifications.count,
  };
}

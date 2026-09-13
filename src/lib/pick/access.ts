import { prisma } from "@/lib/prisma";

export async function permittedPickParticipantIds({
  viewerUserId,
  participants,
}: {
  viewerUserId: string;
  participants: Array<{ id: string; userId?: string | null }>;
}) {
  const counterpartIds = participants
    .map((participant) => participant.userId)
    .filter((userId): userId is string => Boolean(userId) && userId !== viewerUserId);
  const blocks = counterpartIds.length > 0
    ? await prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerId: viewerUserId, blockedId: { in: counterpartIds } },
            { blockedId: viewerUserId, blockerId: { in: counterpartIds } },
          ],
        },
        select: { blockerId: true, blockedId: true },
      })
    : [];
  const blockedUserIds = new Set(
    blocks.flatMap((block) => [block.blockerId, block.blockedId]).filter((userId) => userId !== viewerUserId),
  );

  return participants
    .filter((participant) => !participant.userId || !blockedUserIds.has(participant.userId))
    .map((participant) => participant.id);
}

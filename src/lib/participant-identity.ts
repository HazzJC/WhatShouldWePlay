import { setParticipantIdentity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function claimSessionParticipantForUser({
  shareToken,
  participantId,
  userId,
  displayName,
}: {
  shareToken: string;
  participantId?: string;
  userId: string;
  displayName: string;
}) {
  const session = await prisma.session.findUnique({
    where: { shareToken },
    select: { id: true, gameNightId: true },
  });

  if (!session) {
    return undefined;
  }

  const existing = await prisma.participant.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId } },
    select: { id: true, isHost: true },
  });
  const requested = participantId
    ? await prisma.participant.findFirst({
        where: { id: participantId, sessionId: session.id },
        select: { id: true, userId: true, isHost: true },
      })
    : null;

  let participant = existing;

  if (!participant && requested && (requested.userId === null || requested.userId === userId)) {
    participant = await prisma.participant.update({
      where: { id: requested.id },
      data: { userId, name: displayName },
      select: { id: true, isHost: true },
    });
  }

  if (!participant) {
    participant = await prisma.participant.create({
      data: { sessionId: session.id, userId, name: displayName },
      select: { id: true, isHost: true },
    });
  }

  if (participant.isHost && session.gameNightId) {
    await prisma.gameNight.updateMany({
      where: { id: session.gameNightId, ownerUserId: null },
      data: { ownerUserId: userId, lastActivityAt: new Date() },
    });
  }

  await setParticipantIdentity(session.id, participant.id, { isHost: participant.isHost });
  return participant.id;
}

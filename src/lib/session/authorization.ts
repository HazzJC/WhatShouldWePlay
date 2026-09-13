import { getCurrentUser, getHostParticipantId, getParticipantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionActor } from "@/lib/session/contracts";

export async function resolveSessionActor(sessionId: string): Promise<SessionActor> {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    const [participant, ownedSession] = await Promise.all([
      prisma.participant.findUnique({
        where: { sessionId_userId: { sessionId, userId: currentUser.id } },
        select: { id: true, isHost: true },
      }),
      prisma.session.findFirst({
        where: { id: sessionId, gameNight: { ownerUserId: currentUser.id } },
        select: { id: true },
      }),
    ]);

    if (ownedSession) {
      return {
        kind: "owner",
        userId: currentUser.id,
        sessionId,
        participantId: participant?.id ?? null,
      };
    }

    if (participant) {
      return {
        kind: "member",
        userId: currentUser.id,
        participantId: participant.id,
        sessionId,
        isHost: participant.isHost,
      };
    }

    return { kind: "visitor" };
  }

  const participantId = await getParticipantId(sessionId);
  if (!participantId) {
    return { kind: "visitor" };
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, sessionId, userId: null },
    select: { id: true, isHost: true },
  });
  if (!participant) {
    return { kind: "visitor" };
  }

  const signedHostId = await getHostParticipantId(sessionId);
  return {
    kind: "guest",
    participantId: participant.id,
    sessionId,
    isHost: participant.isHost && signedHostId === participant.id,
  };
}

export function actorParticipantId(actor: SessionActor) {
  return actor.kind === "visitor" ? null : actor.participantId;
}

export function actorCanManageSession(actor: SessionActor) {
  return actor.kind === "owner" || (actor.kind !== "visitor" && actor.isHost);
}

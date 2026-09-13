import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashSessionToken, setParticipantIdentity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HANDOFF_LIFETIME_MS = 10 * 60 * 1000;

export async function createDiscordHostHandoff({
  discordUserId,
  sessionId,
  participantId,
  client = prisma,
}: {
  discordUserId: string;
  sessionId: string;
  participantId: string;
  client?: Pick<Prisma.TransactionClient, "discordHostHandoff">;
}) {
  const token = randomBytes(32).toString("base64url");
  await client.discordHostHandoff.create({
    data: {
      tokenHash: hashSessionToken(token),
      discordUserId,
      sessionId,
      participantId,
      expiresAt: new Date(Date.now() + HANDOFF_LIFETIME_MS),
    },
  });
  return token;
}

export async function redeemDiscordHostHandoff(token: string) {
  const tokenHash = hashSessionToken(token);
  const redeemed = await prisma.$transaction(async (tx) => {
    const handoff = await tx.discordHostHandoff.findUnique({
      where: { tokenHash },
      include: {
        session: { select: { id: true, shareToken: true } },
        participant: { select: { id: true, sessionId: true, isHost: true, discordUserId: true } },
      },
    });
    if (
      !handoff ||
      handoff.redeemedAt ||
      handoff.expiresAt <= new Date() ||
      handoff.participant.sessionId !== handoff.sessionId ||
      !handoff.participant.isHost ||
      handoff.participant.discordUserId !== handoff.discordUserId
    ) {
      return null;
    }
    const consumed = await tx.discordHostHandoff.updateMany({
      where: { id: handoff.id, redeemedAt: null, expiresAt: { gt: new Date() } },
      data: { redeemedAt: new Date() },
    });
    return consumed.count === 1 ? handoff : null;
  });
  if (!redeemed) return null;

  await setParticipantIdentity(redeemed.session.id, redeemed.participant.id, { isHost: true });
  return `/s/${redeemed.session.shareToken}?participant=${redeemed.participant.id}`;
}

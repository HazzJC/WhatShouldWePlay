import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function joinPickWorkspace({
  sessionId,
  userId,
  displayName,
}: {
  sessionId: string;
  userId: string;
  displayName: string;
}) {
  try {
    return await prisma.participant.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, name: displayName },
      update: {},
      select: { id: true, isHost: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const existing = await prisma.participant.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
      select: { id: true, isHost: true },
    });
    if (!existing) throw error;
    return existing;
  }
}

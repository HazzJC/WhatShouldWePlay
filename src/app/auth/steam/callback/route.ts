import { redirect } from "next/navigation";
import { createUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySteamOpenIdCallback } from "@/lib/steam";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken") ?? "";
  const participantId = url.searchParams.get("participant") ?? "";
  const steamId = await verifySteamOpenIdCallback(url.searchParams);

  if (!steamId) {
    redirect(shareToken ? `/s/${shareToken}?tab=pick&steam=failed` : "/?steam=failed");
  }

  const existingSteam = await prisma.steamAccount.findUnique({
    where: { steamId },
    include: { user: true },
  });
  const user =
    existingSteam?.user ??
    (await prisma.user.create({
      data: {
        displayName: `Steam ${steamId}`,
        steamAccount: {
          create: {
            steamId,
          },
        },
      },
    }));

  if (!existingSteam) {
    await prisma.steamAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, steamId },
      update: { steamId },
    });
  }

  if (shareToken && participantId) {
    await prisma.participant.updateMany({
      where: {
        id: participantId,
        session: { shareToken },
      },
      data: { userId: user.id },
    });
  }

  await createUserSession(user.id);
  redirect(shareToken ? `/s/${shareToken}?participant=${participantId}&tab=pick` : "/");
}

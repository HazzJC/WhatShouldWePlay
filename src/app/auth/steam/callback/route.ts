import { redirect } from "next/navigation";
import { createUserSession, getCurrentUser, safeInternalRedirect } from "@/lib/auth";
import { onboardingUrl } from "@/lib/accounts";
import { createAccountMergeIntent } from "@/lib/account-merge";
import { prisma } from "@/lib/prisma";
import { verifySteamOpenIdCallback } from "@/lib/steam";

function withSteamStatus(path: string, status: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("steam", status);
  return `${destination.pathname}${destination.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get("shareToken") ?? "";
  const participantId = url.searchParams.get("participant") ?? "";
  const friendInvite = url.searchParams.get("friendInvite") ?? "";
  const redirectTo = safeInternalRedirect(url.searchParams.get("redirectTo"));
  const steamId = await verifySteamOpenIdCallback(url.searchParams);
  const currentUser = await getCurrentUser();

  if (!steamId) {
    redirect(friendInvite ? `/friends/invite/${friendInvite}?steam=failed` : shareToken ? `/s/${shareToken}?tab=pick&steam=failed` : withSteamStatus(redirectTo, "failed"));
  }

  const existingSteam = await prisma.steamAccount.findUnique({
    where: { steamId },
    include: { user: true },
  });

  if (currentUser && existingSteam && existingSteam.userId !== currentUser.id) {
    const mergeToken = await createAccountMergeIntent(currentUser.id, existingSteam.userId, "STEAM");
    redirect(`/account/merge?token=${encodeURIComponent(mergeToken)}`);
  }

  const user =
    currentUser ??
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

  let redirectParticipantId = participantId;

  if (shareToken && !redirectParticipantId) {
    const session = await prisma.session.findUnique({
      where: { shareToken },
      select: { id: true },
    });

    if (session) {
      const participant =
        (await prisma.participant.findFirst({
          where: { sessionId: session.id, userId: user.id },
          select: { id: true },
        })) ??
        (await prisma.participant.create({
          data: {
            sessionId: session.id,
            userId: user.id,
            name: user.displayName,
          },
          select: { id: true },
        }));

      redirectParticipantId = participant.id;
    }
  }

  await createUserSession(user.id);
  if (friendInvite) {
    redirect(`/friends/invite/${friendInvite}`);
  }
  const destination = shareToken
    ? `/s/${shareToken}?tab=pick${redirectParticipantId ? `&participant=${redirectParticipantId}` : ""}`
    : redirectTo;
  redirect(user.username && user.onboardingCompletedAt ? destination : onboardingUrl(destination));
}

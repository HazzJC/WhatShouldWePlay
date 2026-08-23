import { redirect } from "next/navigation";
import { consumeOAuthState, createUserSession, getCurrentUser, rotateUserSession, safeInternalRedirect } from "@/lib/auth";
import { onboardingUrl } from "@/lib/accounts";
import { createAccountMergeIntent } from "@/lib/account-merge";
import { prisma } from "@/lib/prisma";
import { verifySteamOpenIdCallback } from "@/lib/steam";
import { claimSessionParticipantForUser } from "@/lib/participant-identity";

function withSteamStatus(path: string, status: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("steam", status);
  return `${destination.pathname}${destination.search}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = await consumeOAuthState(url.searchParams.get("state"));
  if (!state) {
    redirect("/?steam=missing_or_invalid_state");
  }
  const shareToken = state.shareToken ?? "";
  const participantId = state.participant;
  const friendInvite = state.friendInvite ?? "";
  const redirectTo = safeInternalRedirect(state.redirectTo);
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

  const redirectParticipantId = shareToken
    ? await claimSessionParticipantForUser({ shareToken, participantId, userId: user.id, displayName: user.displayName })
    : undefined;

  if (currentUser) await rotateUserSession(user.id);
  else await createUserSession(user.id);
  if (friendInvite) {
    redirect(`/friends/invite/${friendInvite}`);
  }
  const destination = shareToken
    ? `/s/${shareToken}?tab=pick${redirectParticipantId ? `&participant=${redirectParticipantId}` : ""}`
    : redirectTo;
  redirect(user.username && user.onboardingCompletedAt ? destination : onboardingUrl(destination));
}

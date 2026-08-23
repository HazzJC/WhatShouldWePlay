import { redirect } from "next/navigation";
import { onboardingUrl } from "@/lib/accounts";
import { createAccountMergeIntent } from "@/lib/account-merge";
import { consumeOAuthState, createUserSession, getCurrentUser, parseOAuthState, rotateUserSession, safeInternalRedirect } from "@/lib/auth";
import { getMicrosoftProfileFromCode, MicrosoftAuthError } from "@/lib/microsoft-auth";
import { claimSessionParticipantForUser } from "@/lib/participant-identity";
import { prisma } from "@/lib/prisma";

function destinationFromState(state: NonNullable<ReturnType<typeof parseOAuthState>>, participantId?: string) {
  if (state.friendInvite) return `/friends/invite/${state.friendInvite}`;
  if (state.friendGroupInvite) return `/groups/invite/${state.friendGroupInvite}`;
  if (state.shareToken) return `/s/${state.shareToken}?tab=pick${participantId ? `&participant=${participantId}` : ""}`;
  return safeInternalRedirect(state.redirectTo);
}

function withMicrosoftError(path: string, code: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("microsoft_error", code);
  return `${destination.pathname}${destination.search}`;
}

function authErrorCode(error: unknown) {
  return error instanceof MicrosoftAuthError ? error.code : "unknown";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = await consumeOAuthState(url.searchParams.get("state"));

  if (!state) redirect("/?microsoft_error=missing_or_invalid_state");

  const providerError = url.searchParams.get("error");
  if (providerError) redirect(withMicrosoftError(destinationFromState(state), `provider_${providerError}`));

  const code = url.searchParams.get("code");
  if (!code) redirect(withMicrosoftError(destinationFromState(state), "missing_code"));

  let profile: Awaited<ReturnType<typeof getMicrosoftProfileFromCode>>;
  try {
    profile = await getMicrosoftProfileFromCode(code);
  } catch (error) {
    redirect(withMicrosoftError(destinationFromState(state), authErrorCode(error)));
  }

  const currentUser = await getCurrentUser();
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: "MICROSOFT", providerAccountId: profile.sub } },
    include: { user: true },
  });

  if (currentUser && existingAccount && existingAccount.userId !== currentUser.id) {
    const mergeToken = await createAccountMergeIntent(currentUser.id, existingAccount.userId, "MICROSOFT");
    redirect(`/account/merge?token=${encodeURIComponent(mergeToken)}`);
  }

  const user = currentUser
    ? await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          email: currentUser.email ?? profile.email,
          avatarUrl: currentUser.avatarUrl ?? profile.picture,
          lastSignedInAt: new Date(),
          oauthAccounts: {
            upsert: {
              where: { provider_providerAccountId: { provider: "MICROSOFT", providerAccountId: profile.sub } },
              create: { provider: "MICROSOFT", providerAccountId: profile.sub, email: profile.email, avatarUrl: profile.picture },
              update: { email: profile.email, avatarUrl: profile.picture },
            },
          },
        },
      })
    : existingAccount?.user ??
      (await prisma.user.create({
        data: {
          displayName: profile.name,
          email: profile.email,
          avatarUrl: profile.picture,
          lastSignedInAt: new Date(),
          oauthAccounts: {
            create: { provider: "MICROSOFT", providerAccountId: profile.sub, email: profile.email, avatarUrl: profile.picture },
          },
        },
      }));

  if (!currentUser && existingAccount) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: user.email ?? profile.email, avatarUrl: user.avatarUrl ?? profile.picture, lastSignedInAt: new Date() },
    });
  }

  let participantId = state.participant;
  if (state.shareToken) {
    participantId = await claimSessionParticipantForUser({
      shareToken: state.shareToken,
      participantId,
      userId: user.id,
      displayName: user.displayName,
    });
  }

  if (currentUser) await rotateUserSession(user.id);
  else await createUserSession(user.id);

  const destination = destinationFromState(state, participantId);
  redirect(user.username && user.onboardingCompletedAt ? destination : onboardingUrl(destination));
}

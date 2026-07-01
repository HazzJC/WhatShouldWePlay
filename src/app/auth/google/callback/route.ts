import { redirect } from "next/navigation";
import { createUserSession, getCurrentUser, parseOAuthState, rotateUserSession, safeInternalRedirect, setParticipantIdentity } from "@/lib/auth";
import { onboardingUrl } from "@/lib/accounts";
import { createAccountMergeIntent } from "@/lib/account-merge";
import { getGoogleProfileFromCode, GoogleAuthError } from "@/lib/google-auth";
import { prisma } from "@/lib/prisma";

function destinationFromState(state: NonNullable<ReturnType<typeof parseOAuthState>>, participantId?: string) {
  if (state.friendInvite) {
    return `/friends/invite/${state.friendInvite}`;
  }

  if (state.friendGroupInvite) {
    return `/groups/invite/${state.friendGroupInvite}`;
  }

  if (state.shareToken) {
    return `/s/${state.shareToken}?tab=pick${participantId ? `&participant=${participantId}` : ""}`;
  }

  return safeInternalRedirect(state.redirectTo);
}

function withGoogleError(path: string, code: string) {
  const destination = new URL(safeInternalRedirect(path), "https://local.invalid");
  destination.searchParams.set("google_error", code);
  return `${destination.pathname}${destination.search}`;
}

function authErrorCode(error: unknown) {
  if (error instanceof GoogleAuthError) {
    return error.code;
  }

  return "unknown";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const state = parseOAuthState(url.searchParams.get("state"));

  if (!state) {
    redirect("/?google_error=missing_or_invalid_state");
  }

  if (providerError) {
    redirect(withGoogleError(destinationFromState(state), `provider_${providerError}`));
  }

  if (!code) {
    redirect(withGoogleError(destinationFromState(state), "missing_code"));
  }

  let profile: Awaited<ReturnType<typeof getGoogleProfileFromCode>>;

  try {
    profile = await getGoogleProfileFromCode(code);
  } catch (error) {
    redirect(withGoogleError(destinationFromState(state), authErrorCode(error)));
  }

  const currentUser = await getCurrentUser();
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: profile.sub,
      },
    },
    include: { user: true },
  });

  if (currentUser && existingAccount && existingAccount.userId !== currentUser.id) {
    const mergeToken = await createAccountMergeIntent(currentUser.id, existingAccount.userId, "GOOGLE");
    redirect(`/account/merge?token=${encodeURIComponent(mergeToken)}`);
  }

  const user = currentUser
    ? await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          email: currentUser.email ?? profile.email,
          emailVerified: currentUser.emailVerified || profile.emailVerified,
          avatarUrl: currentUser.avatarUrl ?? profile.picture,
          lastSignedInAt: new Date(),
          oauthAccounts: {
            upsert: {
              where: {
                provider_providerAccountId: {
                  provider: "GOOGLE",
                  providerAccountId: profile.sub,
                },
              },
              create: {
                provider: "GOOGLE",
                providerAccountId: profile.sub,
                email: profile.email,
                emailVerified: profile.emailVerified,
                avatarUrl: profile.picture,
              },
              update: {
                email: profile.email,
                emailVerified: profile.emailVerified,
                avatarUrl: profile.picture,
              },
            },
          },
        },
      })
    : existingAccount?.user ??
      (await prisma.user.create({
        data: {
          displayName: profile.name,
          email: profile.email,
          emailVerified: profile.emailVerified,
          avatarUrl: profile.picture,
          lastSignedInAt: new Date(),
          oauthAccounts: {
            create: {
              provider: "GOOGLE",
              providerAccountId: profile.sub,
              email: profile.email,
              emailVerified: profile.emailVerified,
              avatarUrl: profile.picture,
            },
          },
        },
      }));

  if (!currentUser && existingAccount) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email ?? profile.email,
        emailVerified: user.emailVerified || profile.emailVerified,
        avatarUrl: user.avatarUrl ?? profile.picture,
        lastSignedInAt: new Date(),
      },
    });
  }

  let participantId = state.participant;

  if (state.shareToken) {
    participantId = await claimParticipantForUser({
      shareToken: state.shareToken,
      participantId,
      userId: user.id,
      displayName: user.displayName,
    });
  }

  if (currentUser) {
    await rotateUserSession(user.id);
  } else {
    await createUserSession(user.id);
  }

  const destination = destinationFromState(state, participantId);
  redirect(user.username && user.onboardingCompletedAt ? destination : onboardingUrl(destination));
}

async function claimParticipantForUser({
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
    select: { id: true },
  });

  if (!session) {
    return participantId;
  }

  const requested = participantId
    ? await prisma.participant.findFirst({
        where: { id: participantId, sessionId: session.id },
        select: { id: true, userId: true, isHost: true },
      })
    : null;
  let participant =
    requested && (requested.userId === null || requested.userId === userId)
      ? requested
      : null;

  if (!participant) {
    participant =
      (await prisma.participant.findFirst({
        where: { sessionId: session.id, userId },
        select: { id: true, userId: true, isHost: true },
      })) ??
      (await prisma.participant.create({
        data: {
          sessionId: session.id,
          userId,
          name: displayName,
        },
        select: { id: true, userId: true, isHost: true },
      }));
  }

  if (participant.userId !== userId) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { userId },
    });
  }

  await setParticipantIdentity(session.id, participant.id, { isHost: participant.isHost });
  return participant.id;
}

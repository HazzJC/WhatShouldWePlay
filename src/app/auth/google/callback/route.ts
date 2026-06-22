import { redirect } from "next/navigation";
import { createUserSession, getCurrentUser, parseOAuthState, rotateUserSession, safeInternalRedirect, setParticipantIdentity } from "@/lib/auth";
import { getGoogleProfileFromCode } from "@/lib/google-auth";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = parseOAuthState(url.searchParams.get("state"));

  if (!code || !state) {
    redirect("/?google=failed");
  }

  const profile = await getGoogleProfileFromCode(code);
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
    redirect(`${safeInternalRedirect(state.redirectTo)}?google=linked-elsewhere`);
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

  redirect(destinationFromState(state, participantId));
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

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: currentUser.id },
    include: {
      oauthAccounts: {
        select: {
          provider: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      steamAccount: {
        select: {
          steamId: true,
          personaName: true,
          lastImportAt: true,
          lastImportStatus: true,
        },
      },
      preference: true,
      games: {
        include: {
          game: {
            select: {
              title: true,
              steamAppId: true,
              igdbId: true,
            },
          },
        },
      },
      participants: {
        include: {
          session: {
            select: {
              title: true,
              shareToken: true,
              createdAt: true,
            },
          },
        },
      },
      friendsSent: {
        include: {
          friend: {
            select: {
              username: true,
              displayName: true,
            },
          },
        },
      },
      ownedFriendGroups: {
        include: {
          members: {
            select: {
              displayName: true,
              status: true,
              user: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      },
      challengeProgress: {
        include: {
          challenge: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lets-play-games-${user.username ?? "account"}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}

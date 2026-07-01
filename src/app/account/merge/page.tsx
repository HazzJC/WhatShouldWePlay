import Link from "next/link";
import { AlertTriangle, Gamepad2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { confirmAccountMergeAction } from "@/app/account/actions";
import { getCurrentUser, hashSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function AccountMergePage({ searchParams }: PageProps) {
  const query = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/account");
  }

  if (!query?.token) {
    notFound();
  }

  const intent = await prisma.accountMergeIntent.findFirst({
    where: {
      tokenHash: hashSessionToken(query.token),
      currentUserId: user.id,
      expiresAt: { gt: new Date() },
      confirmedAt: null,
    },
    include: {
      otherUser: {
        include: {
          _count: {
            select: {
              games: true,
              friendsSent: true,
              participants: true,
            },
          },
        },
      },
    },
  });

  if (!intent) {
    notFound();
  }

  return (
    <main className="ui-shell">
      <nav className="py-1.5">
        <Link href="/" className="flex items-center gap-2 font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
      </nav>
      <section className="mx-auto max-w-xl py-8">
        <div className="surface p-6">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold/15 text-gold">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-3xl font-black text-ink">Merge two accounts?</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-ink/62">
            The {intent.provider === "STEAM" ? "Steam" : "Google"} identity you just proved belongs to another Let&apos;s Play Games profile.
            Confirming keeps your current username and combines the other profile into it.
          </p>
          <div className="mt-4 rounded-lg border border-ink/10 bg-paper p-4">
            <p className="font-black text-ink">{intent.otherUser.displayName}</p>
            <p className="mt-1 text-sm font-bold text-ink/55">
              {intent.otherUser.username ? `@${intent.otherUser.username} · ` : ""}
              {intent.otherUser._count.games} games · {intent.otherUser._count.friendsSent} friends · {intent.otherUser._count.participants} sessions
            </p>
          </div>
          <p className="mt-4 text-xs font-bold leading-5 text-ink/50">
            Existing values on your current account win when both profiles contain different ratings or notes. Ownership, playtime, wishlists, friends, groups, and challenge completion are combined.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <form action={confirmAccountMergeAction}>
              <input type="hidden" name="token" value={query.token} />
              <button type="submit" className="primary-button">Merge accounts</button>
            </form>
            <Link href="/account" className="secondary-button">Keep separate</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

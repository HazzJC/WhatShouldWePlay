"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Compass, Gamepad2, History, LogOut, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const primaryLinks = [
  { href: "/sessions/new", label: "Plan", icon: CalendarDays },
  { href: "/sessions/pick", label: "Pick", icon: Gamepad2 },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/game-nights", label: "Game nights", icon: History },
] as const;

export function AppNavigation() {
  const [user, setUser] = useState<{ username: string | null; displayName: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setUser(value?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-3 sm:px-5 lg:px-6">
          <Link href="/" className="focus-ring flex shrink-0 items-center gap-2 font-bold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-teal text-white">
              <Gamepad2 className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Let&apos;s Play Games</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {primaryLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-ink/65 hover:bg-linen hover:text-ink">
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <details className="relative">
            <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-ink">
              <UserRound className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.username ? `@${user.username}` : "Sign in"}</span>
            </summary>
            <div className="absolute right-0 top-full z-[80] mt-2 grid w-64 gap-1 rounded-lg border border-ink/10 bg-white p-2 shadow-card">
              {user ? (
                <>
                  <p className="truncate px-2 py-2 text-xs font-medium text-ink/50">{user.displayName}</p>
                  <MenuLink href="/account" label="Account" />
                  <MenuLink href="/account/library" label="Library" />
                  <MenuLink href="/friends" label="Friends" />
                  <MenuLink href="/groups" label="Groups" />
                  <MenuLink href="/release-notes" label="Updates" />
                  <form action="/auth/logout" method="post">
                    <input type="hidden" name="redirectTo" value="/" />
                    <button className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm font-semibold text-ink/65 hover:bg-linen hover:text-ink">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <MenuLink href="/account" label="Sign in or create account" />
                  <MenuLink href="/release-notes" label="Updates" />
                </>
              )}
              <div className="mt-1 border-t border-ink/10 pt-2">
                <p className="mb-2 px-1 text-xs font-medium text-ink/50">Appearance</p>
                <ThemeToggle />
              </div>
            </div>
          </details>
        </div>
      </header>

      <nav className="app-mobile-nav" aria-label="Mobile navigation">
        {primaryLinks.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="focus-ring grid min-w-0 flex-1 place-items-center gap-0.5 py-2 text-[0.68rem] font-semibold text-ink/60">
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <Link href="/account" className="focus-ring grid min-w-0 flex-1 place-items-center gap-0.5 py-2 text-[0.68rem] font-semibold text-ink/60">
          <UserRound className="h-5 w-5" />
          <span>{user ? "Account" : "Sign in"}</span>
        </Link>
      </nav>
    </>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="rounded px-2 py-2 text-sm font-semibold text-ink/65 hover:bg-linen hover:text-ink">{label}</Link>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Compass, Gamepad2, History, Info, LogOut, ScrollText, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";

const primaryLinks = [
  { href: "/sessions/new", label: "Plan", hint: "Find a time", icon: CalendarDays, tone: "plan" },
  { href: "/sessions/pick", label: "Pick", hint: "Choose a game", icon: Gamepad2, tone: "pick" },
  { href: "/discover", label: "Discover", hint: "Browse ideas", icon: Compass, tone: "discover" },
  { href: "/game-nights", label: "Your nights", hint: "Back to the crew", icon: History, tone: "nights" },
] as const;

export function AppNavigation() {
  const [user, setUser] = useState<{ username: string | null; displayName: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setUser(value?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return (
    <>
      <header className="app-header">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between gap-4 px-3 sm:px-5 lg:px-6">
          <Link href="/" className="app-logo focus-ring flex shrink-0 items-center gap-2 font-bold text-ink">
            <BrandMark compact />
            <span className="hidden leading-none sm:block"><span className="block text-[0.95rem] font-black">Let&apos;s Play</span><span className="mt-1 block text-[0.64rem] font-bold uppercase tracking-[0.18em] text-ink/42">Plan · Pick · Play</span></span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {primaryLinks.map(({ href, label, hint, icon: Icon, tone }) => (
              <Link key={href} href={href} data-tone={tone} aria-current={isActivePath(pathname, href) ? "page" : undefined} className={`nav-link focus-ring inline-flex items-center gap-2 rounded-xl px-2.5 py-2 ${isActivePath(pathname, href) ? "is-active" : ""}`}>
                <span className="nav-icon"><Icon className="h-4 w-4" /></span>
                <span className="leading-none"><span className="block text-sm font-black">{label}</span><span className="mt-1 hidden text-[0.62rem] font-bold text-ink/42 xl:block">{hint}</span></span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle compact />
            <details className="relative">
              <summary className="account-trigger focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm font-black text-ink shadow-sm">
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">{user?.username ? `@${user.username}` : "Sign in"}</span>
              </summary>
              <div className="account-menu absolute right-0 top-full z-[80] mt-2 grid w-64 gap-1 rounded-2xl border border-ink/10 bg-white p-2 shadow-card">
                {user ? (
                  <>
                    <p className="truncate px-2 py-2 text-xs font-medium text-ink/50">{user.displayName}</p>
                    <MenuLink href="/account" label="Account" />
                    <MenuLink href="/account/library" label="Library" />
                    <MenuLink href="/friends" label="Friends" />
                    <MenuLink href="/groups" label="Groups" />
                    <MenuLink href="/about" label="About" icon={Info} />
                    <MenuLink href="/changelog" label="Changelog" icon={ScrollText} />
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
                    <MenuLink href="/about" label="About" icon={Info} />
                    <MenuLink href="/changelog" label="Changelog" icon={ScrollText} />
                  </>
                )}
                <div className="mt-1 border-t border-ink/10 pt-2">
                  <p className="mb-2 px-1 text-xs font-medium text-ink/50">Appearance</p>
                  <ThemeToggle />
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav className="app-mobile-nav" aria-label="Mobile navigation">
        {primaryLinks.map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href} data-tone={tone} aria-current={isActivePath(pathname, href) ? "page" : undefined} className={`mobile-nav-link focus-ring grid min-w-0 flex-1 place-items-center gap-0.5 py-2 text-[0.64rem] font-black ${isActivePath(pathname, href) ? "is-active" : ""}`}>
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
        <Link href="/account" className="mobile-nav-link focus-ring grid min-w-0 flex-1 place-items-center gap-0.5 py-2 text-[0.64rem] font-black text-ink/55">
          <UserRound className="h-5 w-5" />
          <span>{user ? "Account" : "Sign in"}</span>
        </Link>
      </nav>
    </>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/sessions/new" || href === "/sessions/pick") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuLink({ href, label, icon: Icon }: { href: string; label: string; icon?: typeof Info }) {
  return <Link href={href} className="nav-link flex items-center gap-2 rounded px-2 py-2 text-sm font-semibold text-ink/65 hover:bg-linen hover:text-ink">{Icon ? <Icon className="h-4 w-4" /> : null}{label}</Link>;
}

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Gamepad2, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const googleErrorMessages: Record<string, string> = {
  missing_or_invalid_state: "Google sign-in could not verify the return state. Try signing in again from this page.",
  missing_code: "Google did not return an authorization code.",
  not_configured: "Google sign-in is not configured. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  provider_access_denied: "Google sign-in was cancelled before permission was granted.",
  token_exchange_failed: "Google rejected the code exchange. Check the client secret and redirect URI.",
  missing_id_token: "Google did not return an identity token.",
  tokeninfo_failed: "Google returned an identity token that could not be verified.",
  invalid_issuer: "Google returned an identity token with an invalid issuer.",
  invalid_audience: "Google returned an identity token for a different client ID.",
  expired_token: "Google returned an expired identity token.",
  missing_subject: "Google did not return a stable account id.",
  unverified_email: "This Google account does not have a verified email address.",
  linked_elsewhere: "This Google account is already connected to another profile.",
  unknown: "Google sign-in failed unexpectedly. Check the server logs for more detail.",
};

const steamMessages: Record<string, string> = {
  failed: "Steam sign-in did not complete. Try connecting Steam again.",
  "linked-elsewhere": "This Steam account is already connected to another profile.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(value)
    : "Not yet";
}

export default async function AccountPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const googleError = firstParam(params.google_error);
  const steamStatus = firstParam(params.steam);
  const user = await getCurrentUser();
  const googleAccount = user?.oauthAccounts.find((account) => account.provider === "GOOGLE") ?? null;

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between gap-3 py-1.5">
        <Link href="/" className="flex items-center gap-2 text-base font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white shadow-card">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
        <div className="flex gap-2">
          <Link href="/groups" className="secondary-button">
            Groups
          </Link>
          <Link href="/" className="secondary-button">
            Home
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-4xl gap-4 py-5">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">Account</p>
          <h1 className="mt-2 text-3xl font-black text-ink sm:text-4xl">Your profile and connections</h1>
          <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-ink/62">
            Google keeps your account available across devices. Steam stays separate and is only used for library matching.
          </p>
        </div>

        {googleError ? (
          <AuthNotice tone="error" title={`Google auth error: ${googleError}`} detail={googleErrorMessages[googleError] ?? googleErrorMessages.unknown} />
        ) : null}
        {steamStatus ? (
          <AuthNotice tone={steamStatus === "linked" ? "success" : "error"} title={`Steam status: ${steamStatus}`} detail={steamMessages[steamStatus] ?? "Steam connection updated."} />
        ) : null}

        {!user ? (
          <section className="surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-ink">You&apos;re signed out</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-ink/62">
                  Sign in with Google to save friend groups, preferences, and linked game libraries across devices.
                </p>
              </div>
              <a href={`/auth/google/start?redirectTo=${encodeURIComponent("/account")}`} className="primary-button">
                Sign in with Google
              </a>
            </div>
          </section>
        ) : (
          <>
            <section className="surface p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  {user.avatarUrl ? (
                    <Image src={user.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 place-items-center rounded-lg bg-teal/12 text-teal">
                      <UserRound className="h-7 w-7" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-ink">{user.displayName}</h2>
                    <p className="truncate text-sm font-bold text-ink/58">{user.email ?? "No email on this profile"}</p>
                  </div>
                </div>
                <form action="/auth/logout" method="post">
                  <input type="hidden" name="redirectTo" value="/account" />
                  <button type="submit" className="secondary-button">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <ProviderCard
                title="Google"
                icon={<Mail className="h-5 w-5" />}
                status={googleAccount ? "Connected" : "Not connected"}
                detail={
                  googleAccount
                    ? `${googleAccount.email ?? user.email ?? "Google account"}${googleAccount.emailVerified ? " - verified" : ""}`
                    : "Connect Google for cross-device access and account recovery."
                }
                action={
                  googleAccount ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-moss/12 px-3 py-1 text-sm font-black text-moss">
                      <ShieldCheck className="h-4 w-4" />
                      Linked
                    </span>
                  ) : (
                    <a href={`/auth/google/start?redirectTo=${encodeURIComponent("/account")}`} className="primary-button">
                      Connect Google
                    </a>
                  )
                }
              />

              <ProviderCard
                title="Steam"
                icon={<Gamepad2 className="h-5 w-5" />}
                status={user.steamAccount ? "Connected" : "Not connected"}
                detail={
                  user.steamAccount
                    ? `SteamID ${user.steamAccount.steamId} - last import ${formatDate(user.steamAccount.lastImportAt)}`
                    : "Connect Steam when you want to import owned games and compare libraries."
                }
                action={
                  user.steamAccount ? (
                    <a href={`/auth/steam/start?redirectTo=${encodeURIComponent("/account")}`} className="secondary-button">
                      Reconnect Steam
                    </a>
                  ) : (
                    <a href={`/auth/steam/start?redirectTo=${encodeURIComponent("/account")}`} className="primary-button">
                      Connect Steam
                    </a>
                  )
                }
              />
            </section>

            <section className="surface p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black text-ink">Friend groups</h2>
                  <p className="mt-1 text-sm font-bold leading-6 text-ink/62">
                    Reuse saved groups and start Pick sessions with the same crew.
                  </p>
                </div>
                <Link href="/groups" className="secondary-button">
                  Manage groups
                </Link>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function AuthNotice({ tone, title, detail }: { tone: "error" | "success"; title: string; detail: string }) {
  const classes = tone === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-moss/25 bg-moss/10 text-moss";

  return (
    <section className={`rounded-lg border p-4 ${classes}`}>
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm font-bold leading-6 opacity-80">{detail}</p>
    </section>
  );
}

function ProviderCard({
  title,
  icon,
  status,
  detail,
  action,
}: {
  title: string;
  icon: ReactNode;
  status: string;
  detail: string;
  action: ReactNode;
}) {
  return (
    <section className="surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal/12 text-teal">{icon}</span>
          <div>
            <h2 className="text-xl font-black text-ink">{title}</h2>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/45">{status}</p>
          </div>
        </div>
        {action}
      </div>
      <p className="mt-4 text-sm font-bold leading-6 text-ink/62">{detail}</p>
    </section>
  );
}

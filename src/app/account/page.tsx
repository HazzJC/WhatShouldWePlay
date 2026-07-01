import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Download, Gamepad2, Library, LogOut, Mail, Pencil, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import {
  deleteAccountAction,
  removeProfileAvatarAction,
  removeRecentSessionAction,
  updateAccountProfileAction,
  uploadProfileAvatarAction,
} from "@/app/account/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const merged = firstParam(params.merged);
  const avatarStatus = firstParam(params.avatar);
  const avatarError = firstParam(params.avatar_error);
  const returnTo = firstParam(params.returnTo) ?? "/account";
  const user = await getCurrentUser();
  const googleAccount = user?.oauthAccounts.find((account) => account.provider === "GOOGLE") ?? null;
  const recentParticipants = user
    ? await prisma.participant.findMany({
        where: { userId: user.id },
        include: { session: true },
        orderBy: { session: { updatedAt: "desc" } },
        take: 8,
      })
    : [];

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
        {merged === "true" ? (
          <AuthNotice tone="success" title="Accounts merged" detail="Your providers, game library, friends, groups, preferences, and session history now use this account." />
        ) : null}
        {avatarStatus ? (
          <AuthNotice tone="success" title="Profile picture updated" detail={avatarStatus === "removed" ? "Your uploaded picture was removed." : "Your new profile picture is now visible across your account."} />
        ) : null}
        {avatarError ? (
          <AuthNotice tone="error" title="Profile picture not changed" detail={avatarError} />
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
              <div className="flex flex-wrap gap-2">
                <a href={providerStartUrl("google", returnTo)} className="primary-button">
                  Sign in with Google
                </a>
                <a href={providerStartUrl("steam", returnTo)} className="secondary-button">
                  Sign in with Steam
                </a>
              </div>
            </div>
          </section>
        ) : (
          <>
            {!user.username ? (
              <section className="rounded-lg border border-gold/35 bg-gold/10 p-4">
                <p className="font-black text-ink">Finish creating your account</p>
                <p className="mt-1 text-sm font-bold leading-6 text-ink/62">
                  Choose a username before entering a Pick workspace or adding friends.
                </p>
                <Link href={`/account/onboarding?returnTo=${encodeURIComponent(returnTo)}`} className="primary-button mt-3">
                  Choose username
                </Link>
              </section>
            ) : null}

            <section className="surface p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative shrink-0">
                    {user.avatarUrl ? (
                      <Image src={user.avatarUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-14 w-14 place-items-center rounded-lg bg-teal/12 text-teal">
                        <UserRound className="h-7 w-7" />
                      </span>
                    )}
                    <details className="group absolute -bottom-2 -right-2 z-20">
                      <summary
                        className="focus-ring grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full border-2 border-white bg-teal text-white shadow-card transition hover:bg-ink"
                        aria-label="Edit profile picture"
                        title="Edit profile picture"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </summary>
                      <div className="absolute left-0 top-full mt-2 w-72 rounded-lg border border-ink/10 bg-white p-3 shadow-soft sm:left-auto sm:right-0">
                        <p className="font-black text-ink">Profile picture</p>
                        <p className="mt-1 text-xs font-bold leading-5 text-ink/52">JPEG, PNG, or WebP. Maximum 512 KB.</p>
                        <form action={uploadProfileAvatarAction} className="mt-3 grid gap-2">
                          <input name="avatar" type="file" required accept="image/jpeg,image/png,image/webp" className="block w-full text-xs font-bold text-ink" />
                          <PendingSubmitButton className="primary-button justify-center px-3 py-2" pendingLabel="Uploading...">
                            Upload picture
                          </PendingSubmitButton>
                        </form>
                        {user.avatarUrl ? (
                          <form action={removeProfileAvatarAction} className="mt-2">
                            <button type="submit" className="secondary-button w-full justify-center px-3 py-2">
                              <X className="h-4 w-4" />
                              Remove picture
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </details>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black text-ink">{user.displayName}</h2>
                    <p className="truncate text-sm font-bold text-ink/58">
                      {user.username ? `@${user.username}` : "Username not set"} · {user.email ?? "No email on this profile"}
                    </p>
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

            <section className="surface p-5">
              <h2 className="text-xl font-black text-ink">Recent sessions</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {recentParticipants.length ? recentParticipants.map((participant) => (
                  <article key={participant.id} className="rounded-lg border border-ink/10 bg-paper p-3">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/s/${participant.session.shareToken}?participant=${participant.id}`}
                        className="min-w-0 flex-1 transition hover:text-teal"
                      >
                        <p className="truncate font-black text-ink">{participant.session.title}</p>
                        <p className="mt-1 text-xs font-bold text-ink/48">
                          {participant.isHost ? "Host" : "Participant"} · updated {participant.session.updatedAt.toLocaleDateString("en-GB")}
                        </p>
                      </Link>
                      <details className="relative">
                        <summary className="focus-ring grid h-8 w-8 cursor-pointer list-none place-items-center rounded-md text-ink/45 hover:bg-red-50 hover:text-red-800" aria-label={`${participant.isHost ? "Delete" : "Remove"} ${participant.session.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </summary>
                        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-red-200 bg-white p-3 shadow-card">
                          <p className="text-sm font-black text-red-800">
                            {participant.isHost ? "Delete this session?" : "Remove from recent sessions?"}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-ink/55">
                            {participant.isHost
                              ? "This permanently deletes the shared session for everyone."
                              : "The shared session remains available, but it will no longer be linked to your account."}
                          </p>
                          <form action={removeRecentSessionAction} className="mt-3">
                            <input type="hidden" name="participantId" value={participant.id} />
                            <PendingSubmitButton className="secondary-button w-full justify-center border-red-300 px-3 py-2 text-red-800" pendingLabel="Removing...">
                              {participant.isHost ? "Delete session" : "Remove from recents"}
                            </PendingSubmitButton>
                          </form>
                        </div>
                      </details>
                    </div>
                  </article>
                )) : (
                  <p className="text-sm font-bold text-ink/52">Signed-in Plan and Pick sessions will appear here automatically.</p>
                )}
              </div>
            </section>

            <section className="surface p-5">
              <h2 className="text-xl font-black text-ink">Gaming profile</h2>
              <form action={updateAccountProfileAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-bold text-ink">Display name</span>
                  <input name="displayName" required maxLength={80} defaultValue={user.displayName} className="field" />
                </label>
                <label>
                  <span className="text-sm font-bold text-ink">Favourite genres</span>
                  <input
                    name="favouriteGenres"
                    defaultValue={Array.isArray(user.favouriteGenres) ? user.favouriteGenres.join(", ") : ""}
                    placeholder="Co-op, RPG, survival"
                    className="field"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-ink sm:col-span-2">
                  <input type="checkbox" name="directoryVisible" defaultChecked={user.directoryVisible} />
                  Let signed-in users find my gaming profile by username
                </label>
                <button type="submit" className="primary-button w-fit">Save profile</button>
                {user.username ? (
                  <Link href="/account/onboarding?returnTo=%2Faccount" className="secondary-button w-fit">
                    Change username
                  </Link>
                ) : null}
              </form>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-ink">Your games</h2>
                  <p className="mt-1 text-sm font-bold text-ink/62">Maintain ownership, ratings, wishlists, and notes once for every future Pick.</p>
                </div>
                <Link href="/account/library" className="primary-button">
                  <Library className="h-4 w-4" />
                  Open library
                </Link>
              </div>
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
                <Link href="/friends" className="secondary-button">
                  Find friends
                </Link>
              </div>
            </section>

            <section className="surface p-5">
              <h2 className="text-xl font-black text-ink">Data and account deletion</h2>
              <p className="mt-1 text-sm font-bold leading-6 text-ink/55">Export your data or permanently remove this account.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="/account/export" className="secondary-button w-fit">
                  <Download className="h-4 w-4" />
                  Export my data
                </a>
                {user.username ? (
                  <details>
                    <summary className="secondary-button cursor-pointer list-none border-red-300 text-red-800">
                      <Trash2 className="h-4 w-4" />
                      Delete account
                    </summary>
                    <form action={deleteAccountAction} className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="font-black text-red-800">Delete account permanently</p>
                      <p className="mt-1 text-sm font-bold leading-6 text-red-800/80">
                        Type <strong>{user.username}</strong> to remove your profile, library, friends, and groups.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input name="confirmation" required className="field max-w-xs" aria-label="Confirm username" />
                        <PendingSubmitButton className="secondary-button border-red-300 text-red-800" pendingLabel="Deleting account...">
                          Delete account permanently
                        </PendingSubmitButton>
                      </div>
                    </form>
                  </details>
                ) : null}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function providerStartUrl(provider: "google" | "steam", returnTo: string) {
  const target = new URL(returnTo, "https://local.invalid");
  const sessionMatch = target.pathname.match(/^\/s\/([^/]+)$/);
  const params = new URLSearchParams({
    redirectTo: returnTo,
  });

  if (sessionMatch?.[1]) {
    params.set("shareToken", sessionMatch[1]);
  }

  const participant = target.searchParams.get("participant");

  if (participant) {
    params.set("participant", participant);
  }

  return `/auth/${provider}/start?${params.toString()}`;
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

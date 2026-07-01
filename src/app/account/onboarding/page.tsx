import Link from "next/link";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { saveUsernameAction } from "@/app/account/actions";
import { getCurrentUser, safeInternalRedirect } from "@/lib/auth";

type PageProps = {
  searchParams?: Promise<{
    returnTo?: string;
    error?: string;
  }>;
};

export default async function AccountOnboardingPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const returnTo = safeInternalRedirect(query?.returnTo);
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/account?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <main className="ui-shell">
      <nav className="flex items-center justify-between gap-3 py-1.5">
        <Link href="/" className="flex items-center gap-2 text-base font-black text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-teal text-white shadow-card">
            <Gamepad2 className="h-5 w-5" />
          </span>
          Let&apos;s Play Games
        </Link>
      </nav>

      <section className="mx-auto max-w-xl py-8">
        <div className="surface p-5 sm:p-7">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-coral">One last step</p>
          <h1 className="mt-2 text-3xl font-black text-ink">Choose your username</h1>
          <p className="mt-3 text-sm font-bold leading-6 text-ink/62">
            This is how friends will find you. It is separate from your display name and never exposes your email or SteamID.
          </p>

          {query?.error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
              {query.error}
            </p>
          ) : null}

          <form action={saveUsernameAction} className="mt-5 grid gap-4">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              <span className="text-sm font-black text-ink">Username</span>
              <div className="mt-1 flex items-center rounded-lg border border-ink/15 bg-white focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20">
                <span className="pl-3 text-sm font-black text-ink/40">@</span>
                <input
                  name="username"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-z0-9_]{3,24}"
                  defaultValue={user.username ?? ""}
                  autoComplete="username"
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 py-3 font-bold text-ink outline-none"
                  placeholder="player_one"
                />
              </div>
              <span className="mt-1 block text-xs font-bold text-ink/48">
                3–24 lowercase letters, numbers, or underscores. Changes have a 30-day cooldown.
              </span>
            </label>

            <button type="submit" className="primary-button justify-center py-3">
              <ShieldCheck className="h-5 w-5" />
              Save and continue
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

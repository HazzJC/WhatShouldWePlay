import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mb-16 border-t border-ink/10 bg-white/70 md:mb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-ink/58 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p><span className="font-bold text-ink">Let&apos;s Play Games.</span> Less organising, more playing.</p>
        <nav className="flex gap-5" aria-label="About this site">
          <Link href="/about" className="font-semibold hover:text-teal">About</Link>
          <Link href="/changelog" className="font-semibold hover:text-teal">Changelog</Link>
        </nav>
      </div>
    </footer>
  );
}

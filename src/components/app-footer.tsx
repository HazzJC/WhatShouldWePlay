import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function AppFooter() {
  return (
    <footer className="app-footer mb-20 md:mb-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-ink/58 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3"><BrandMark compact /><p><span className="block font-black text-ink">Let&apos;s Play Games</span><span>Find a time and a game your group can play.</span></p></div>
        <nav className="flex gap-5" aria-label="About this site">
          <Link href="/about" className="font-semibold hover:text-teal">About</Link>
          <Link href="/changelog" className="font-semibold hover:text-teal">Changelog</Link>
        </nav>
      </div>
    </footer>
  );
}

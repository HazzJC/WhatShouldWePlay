import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Let's Play Games",
  description: "Find the time, pick the game, get everyone in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var theme = window.localStorage.getItem('theme-mode');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.dataset.theme = theme;
  }
} catch (_) {}
            `.trim(),
          }}
        />
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}

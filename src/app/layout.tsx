import type { Metadata } from "next";
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tournament Manager", template: "%s · Tournament Manager" },
  description: "Create tournaments, generate fixtures and follow live standings and brackets.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 dark:focus:bg-slate-900"
        >
          Skip to content
        </a>
        <header className="border-b border-slate-200 dark:border-slate-800">
          <nav
            className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"
            aria-label="Main"
          >
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span aria-hidden className="inline-block h-3 w-3 rotate-45 bg-accent-600" />
              Tournament Manager
            </Link>
            <Link
              href="/new"
              className="rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
            >
              Create tournament
            </Link>
          </nav>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Fixtures, standings and brackets, updated live.
        </footer>
      </body>
    </html>
  );
}

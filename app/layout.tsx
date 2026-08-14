import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "@fontsource/spline-sans-mono";
import "@fontsource/spline-sans-mono/500.css";
import "./globals.css";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { isDemoMode } from "@/lib/data";

function MobileTopBar() {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5 md:hidden">
      <span className="font-display text-[19px] font-semibold text-ink">Hearth</span>
      <nav className="flex gap-4 text-[13.5px] font-semibold text-ink-secondary">
        <Link href="/">This month</Link>
        <Link href="/import">Import</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Hearth — household ledger",
  description: "Every card, one budget. CSV in, answers out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col md:flex-row">
          <MobileTopBar />
          <Sidebar demo={isDemoMode()} />
          <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/titillium-web/700.css";
import "./globals.css";
import { MobileTopBar, Sidebar } from "@/components/sidebar";
import { isDemoMode } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hearth — household ledger",
  description: "Every card, one budget. CSV in, answers out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Decoration only — the money faces and the two name bubbles that
            drift behind the glass. Hidden from assistive tech. */}
        <div className="pond" aria-hidden>
          <span className="coin coin-1">🤑</span>
          <span className="coin coin-2">💸</span>
          <span className="coin coin-3">💰</span>
          <span className="coin coin-4">🪙</span>
          <span className="coin coin-5">🧾</span>
          <span className="coin coin-6">🤑</span>
          <span className="namebubble namebubble-leon">Leon</span>
          <span className="namebubble namebubble-sara">Sara</span>
        </div>
        <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col md:flex-row">
          <MobileTopBar />
          <Sidebar demo={isDemoMode()} />
          <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

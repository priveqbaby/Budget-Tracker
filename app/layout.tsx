import type { Metadata } from "next";
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/titillium-web/700.css";
import "./globals.css";
import { DemoBanner, MobileTopBar, Sidebar } from "@/components/sidebar";
import { isDemoMode } from "@/lib/data";

export const metadata: Metadata = {
  title: "Hearth — household ledger",
  description: "Every card, one budget. CSV in, answers out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Decoration only — money faces, hearts and the two names drifting
            across the solid ground behind the glass. Hidden from assistive
            tech. Positions are scattered in globals.css. */}
        <div className="pond" aria-hidden>
          <span className="coin coin-1">🤑</span>
          <span className="coin coin-2">💸</span>
          <span className="coin coin-3">💰</span>
          <span className="coin coin-4">🪙</span>
          <span className="coin coin-5">🧾</span>
          <span className="coin coin-6">🤑</span>
          <span className="coin coin-7">💵</span>
          <span className="coin coin-8">🐷</span>
          <span className="coin coin-9">💳</span>
          <span className="coin coin-10">🤑</span>
          <span className="coin coin-11">💸</span>
          <span className="coin coin-12">💰</span>
          <span className="heart heart-1">💗</span>
          <span className="heart heart-2">💞</span>
          <span className="heart heart-3">💖</span>
          <span className="namebubble namebubble-1">Leon</span>
          <span className="namebubble namebubble-2">Sara</span>
          <span className="namebubble namebubble-sm namebubble-3">Sara</span>
          <span className="namebubble namebubble-sm namebubble-4">Leon</span>
          <span className="namebubble namebubble-sm namebubble-5">Leon</span>
          <span className="namebubble namebubble-sm namebubble-6">Sara</span>
          <span className="namebubble namebubble-sm namebubble-7">Sara</span>
          <span className="namebubble namebubble-sm namebubble-8">Leon</span>
        </div>
        <DemoBanner demo={isDemoMode()} />
        <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col md:flex-row">
          <MobileTopBar />
          <Sidebar demo={isDemoMode()} />
          <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

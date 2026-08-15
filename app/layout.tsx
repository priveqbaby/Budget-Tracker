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
        <div className="pond" aria-hidden>
          <span className="bloom bloom-1" /><span className="bloom bloom-2" />
          <span className="bloom bloom-3" /><span className="bloom bloom-4" />
          <span className="bloom bloom-5" />
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

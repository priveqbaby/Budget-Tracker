"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";

const AUTH_PATHS = ["/signin", "/welcome"];

const links = [
  {
    href: "/",
    label: "This month",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 13.5V7.2c0-.4.2-.8.5-1L7.4 2.4a1 1 0 0 1 1.2 0L13.5 6c.3.3.5.7.5 1.1v6.3a1 1 0 0 1-1 1H10v-4H6v4H3a1 1 0 0 1-1-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/import",
    label: "Import",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 10V2m0 8L5.2 7.2M8 10l2.8-2.8M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function MobileTopBar() {
  const pathname = usePathname();
  if (AUTH_PATHS.includes(pathname)) return null;
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

export function Sidebar({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  if (AUTH_PATHS.includes(pathname)) return null;
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col justify-between border-r border-hairline px-4 py-7 md:flex">
      <div>
        <div className="px-2">
          <div className="font-display text-[22px] font-semibold leading-none text-ink">
            Hearth
          </div>
          <div className="mt-1.5 text-[12.5px] font-medium text-ink-muted">
            {demo ? "Leon & Sara · Montréal" : "household ledger"}
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-0.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="navlink"
              data-active={pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href))}
            >
              <span className="text-ink-muted">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-2">
        {demo ? (
          <div className="rounded-lg border border-hairline bg-sunken px-3 py-2.5 text-[12px] leading-snug text-ink-secondary">
            <span className="font-semibold text-ink">Demo data.</span> Set the Supabase env
            vars to go live.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => startTransition(() => signOut())}
            className="navlink w-full"
          >
            Sign out
          </button>
        )}
        <div className="mt-3 text-[11px] text-ink-muted">
          Every card, one budget.
        </div>
      </div>
    </aside>
  );
}

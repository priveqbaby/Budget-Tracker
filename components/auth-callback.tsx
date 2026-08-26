"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reads whatever the magic link left in the URL and trades it for a session
 * cookie. Three shapes arrive here:
 *   #access_token=…&refresh_token=…  implicit — the normal path
 *   ?code=…                          PKCE — links sent before the switch
 *   ?error=…&error_code=…            GoTrue rejected the token upstream
 * On success we hard-navigate so the server renders the next page with the
 * fresh cookie; the dashboard sends first-timers on to /welcome.
 */
export function AuthCallback() {
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    // Effects run twice in dev's strict mode, and these tokens are single-use.
    if (ran.current) return;
    ran.current = true;

    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const query = url.searchParams;

    const upstream = query.get("error_code") ?? query.get("error") ?? hash.get("error_code");
    if (upstream) {
      bail(upstream === "otp_expired" || upstream === "access_denied" ? "expired" : "link");
      return;
    }

    const payload = hash.get("access_token")
      ? {
          access_token: hash.get("access_token"),
          refresh_token: hash.get("refresh_token"),
        }
      : query.get("code")
        ? { code: query.get("code") }
        : null;

    if (!payload) {
      bail("link");
      return;
    }

    // Drop the tokens from the address bar before anything can copy them out.
    window.history.replaceState(null, "", "/auth/callback");

    void (async () => {
      try {
        const res = await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data: { ok?: boolean; reason?: string } = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          window.location.replace("/");
          return;
        }
        bail(data.reason ?? "link");
      } catch {
        bail("link");
      }
    })();

    function bail(reason: string) {
      setFailed(true);
      window.location.replace(`/signin?error=${encodeURIComponent(reason)}`);
    }
  }, []);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="card settle w-full max-w-[400px] px-8 py-9 text-center">
        <div className="font-display text-[30px] font-semibold text-ink">Hearth</div>
        <p className="mt-1.5 text-[13.5px] text-ink-secondary" role="status">
          {failed ? "Taking you back to sign in…" : "Signing you in…"}
        </p>
      </div>
    </div>
  );
}

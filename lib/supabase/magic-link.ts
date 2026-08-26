import { createClient } from "@supabase/supabase-js";

/**
 * The client that *sends* magic links, kept separate from the cookie-bound
 * server client on purpose.
 *
 * `createServerClient` from @supabase/ssr hardcodes `flowType: "pkce"` after
 * spreading whatever auth options it is given, so implicit cannot be selected
 * through it. PKCE ties the link to the browser that requested it: the
 * callback needs that browser's code-verifier cookie, and when the link is
 * opened anywhere else — a phone, another browser, Gmail's in-app viewer —
 * the exchange fails on a token GoTrue has already verified and consumed. The
 * account gets confirmed and no session is ever minted.
 *
 * Sending a link needs no session and no cookies, so this uses plain
 * supabase-js with the implicit flow. GoTrue then returns the session in the
 * URL fragment and the link works from anywhere.
 */
export function createMagicLinkClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

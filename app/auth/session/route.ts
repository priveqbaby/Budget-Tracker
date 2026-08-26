import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data";

/**
 * Turns a verified magic link into a session cookie.
 *
 * The callback page hands us whatever the link carried: implicit tokens from
 * the URL fragment, or a PKCE `code` from a link that predates the switch.
 * Both are validated by GoTrue here — an access token that isn't signed by
 * this project is rejected by `setSession`, so nothing a caller invents gets
 * past this route.
 */
export async function POST(request: NextRequest) {
  if (isDemoMode()) return NextResponse.json({ ok: false, reason: "link" }, { status: 400 });

  let body: { access_token?: unknown; refresh_token?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "link" }, { status: 400 });
  }

  const supabase = await createClient();

  const accessToken = typeof body.access_token === "string" ? body.access_token : null;
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error("[auth/session] setSession failed", { message: error.message, code: error.code });
      return NextResponse.json({ ok: false, reason: "expired" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const code = typeof body.code === "string" ? body.code : null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/session] PKCE exchange failed", { message: error.message, code: error.code });
      return NextResponse.json({ ok: false, reason: "browser" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, reason: "link" }, { status: 400 });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Magic-link landing. Two shapes arrive here:
 *   ?token_hash=&type=  — stateless; verifies from any browser or device.
 *   ?code=              — PKCE; only works in the browser that asked for the
 *                         link, because it needs that browser's verifier cookie.
 * Prefer the token hash when both are present. GoTrue may also redirect here
 * with ?error=, which means the token itself was rejected upstream.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (isDemoMode()) return NextResponse.redirect(`${origin}/`);

  const upstreamError = searchParams.get("error_code") ?? searchParams.get("error");
  if (upstreamError) {
    console.error("[auth/callback] rejected upstream", {
      error: upstreamError,
      description: searchParams.get("error_description"),
    });
    return fail(origin, upstreamError === "otp_expired" ? "expired" : "link");
  }

  const supabase = await createClient();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}/`);
    console.error("[auth/callback] verifyOtp failed", { message: error.message, code: error.code });
    return fail(origin, "expired");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    // The token was fine — GoTrue already consumed it. What's missing is this
    // browser's verifier cookie, so say that instead of blaming the link.
    console.error("[auth/callback] PKCE exchange failed", { message: error.message, code: error.code });
    return fail(origin, "browser");
  }

  console.error("[auth/callback] no code, token_hash, or error param present");
  return fail(origin, "link");
}

function fail(origin: string, reason: "link" | "expired" | "browser") {
  return NextResponse.redirect(`${origin}/signin?error=${reason}`);
}

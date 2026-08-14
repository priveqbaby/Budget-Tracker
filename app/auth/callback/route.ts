import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data";
import type { EmailOtpType } from "@supabase/supabase-js";

/** Magic-link landing: exchange the code (PKCE) or verify the token hash (OTP). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (isDemoMode()) return NextResponse.redirect(`${origin}/`);

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  return NextResponse.redirect(`${origin}${ok ? "/" : "/signin?error=link"}`);
}

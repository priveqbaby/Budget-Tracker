import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/data";
import { SigninForm } from "@/components/signin-form";

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isDemoMode()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="card settle w-full max-w-[400px] px-8 py-9 text-center">
        <div className="font-display text-[30px] font-semibold text-ink">Hearth</div>
        <p className="mt-1.5 text-[13.5px] text-ink-secondary">
          Every card, one budget. Sign in with a magic link — no passwords anywhere.
        </p>
        {error && (
          <p className="chip chip-over mt-4 w-full justify-center" role="alert">
            {SIGNIN_ERRORS[error] ?? SIGNIN_ERRORS.link}
          </p>
        )}
        <SigninForm />
      </div>
    </div>
  );
}

/** Why the callback bounced back here. "browser" is the common one: the link
 *  was opened somewhere other than the browser that requested it, so the PKCE
 *  verifier cookie was missing — the link itself was perfectly good. */
const SIGNIN_ERRORS: Record<string, string> = {
  link: "That sign-in link didn't work. Send a fresh one.",
  expired: "That link expired or was already used. Send a fresh one.",
  browser:
    "Open the link in this same browser — the one you asked for it from. Send a fresh one and click it here.",
};

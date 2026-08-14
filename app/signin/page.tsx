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
        {error === "link" && (
          <p className="chip chip-over mt-4 w-full justify-center" role="alert">
            That link expired or was already used. Send a fresh one.
          </p>
        )}
        <SigninForm />
      </div>
    </div>
  );
}

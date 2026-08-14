"use client";

import { useState, useTransition } from "react";
import { sendMagicLink } from "@/app/auth/actions";

export function SigninForm() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <div className="mt-6 rounded-[10px] bg-ok-track px-4 py-4 text-[13.5px] font-medium text-ink">
        {result.message}
      </div>
    );
  }

  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.includes("@")) return;
        startTransition(async () => {
          setResult(await sendMagicLink(email.trim(), window.location.origin));
        });
      }}
    >
      <input
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="field text-center"
        aria-label="Email address"
      />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Sending…" : "Send magic link"}
      </button>
      {result && !result.ok && (
        <p className="text-[12.5px] font-medium text-danger" role="alert">{result.message}</p>
      )}
    </form>
  );
}

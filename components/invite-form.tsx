"use client";

import { useState, useTransition } from "react";
import { sendInvite } from "@/app/actions";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.includes("@")) return;
        startTransition(async () => {
          await sendInvite(email.trim());
          setEmail("");
          setSent(true);
          setTimeout(() => setSent(false), 2500);
        });
      }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="invite by email"
        className="field flex-1"
        aria-label="Email address to invite"
      />
      <button type="submit" className="btn btn-ghost" disabled={pending || !email.includes("@")}>
        {sent ? "Invited ✓" : pending ? "…" : "Invite"}
      </button>
    </form>
  );
}

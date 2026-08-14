"use client";

import { useState, useTransition } from "react";
import { acceptInvite, createHousehold } from "@/app/auth/actions";

interface InviteDto {
  id: string;
  householdName: string;
}

export function WelcomeForms({
  suggestedName,
  invites,
}: {
  suggestedName: string;
  invites: InviteDto[];
}) {
  const [displayName, setDisplayName] = useState(
    suggestedName.replace(/\b\w/g, (c) => c.toUpperCase()),
  );
  const [householdName, setHouseholdName] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6">
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold text-ink-secondary">
          Your name, as the household will see it
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="field"
        />
      </label>

      {invites.length > 0 && (
        <div className="mt-6">
          <div className="overline mb-2">You’ve been invited</div>
          {invites.map((invite) => (
            <button
              key={invite.id}
              type="button"
              disabled={pending || !displayName.trim()}
              className="btn btn-primary mb-2 w-full"
              onClick={() =>
                startTransition(() => acceptInvite(invite.id, displayName.trim()))
              }
            >
              Join {invite.householdName}
            </button>
          ))}
          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            <span className="h-px flex-1 bg-hairline-deep" /> or <span className="h-px flex-1 bg-hairline-deep" />
          </div>
        </div>
      )}

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!householdName.trim() || !displayName.trim()) return;
          startTransition(() => createHousehold(householdName.trim(), displayName.trim()));
        }}
      >
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-ink-secondary">
            Start a new household
          </span>
          <input
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="e.g. Leon & Sara"
            className="field"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary mt-3 w-full"
          disabled={pending || !householdName.trim() || !displayName.trim()}
        >
          {pending ? "Setting up…" : "Create household"}
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-muted">
          Seeds the 17 budget lines with their caps — everything editable in Settings.
        </p>
      </form>
    </div>
  );
}

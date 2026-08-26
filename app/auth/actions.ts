"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createMagicLinkClient } from "@/lib/supabase/magic-link";
import { getStore, isDemoMode } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/data/default-categories";
import type { SourceKind } from "@/lib/data/types";

/** Derived server-side — never trust a caller-supplied origin in an email redirect. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
  if (isDemoMode()) return { ok: false, message: "Demo mode has no sign-in — the data is seeded." };
  const supabase = createMagicLinkClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await requestOrigin()}/auth/callback` },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Check your inbox for the magic link." };
}

export async function signOut() {
  if (!isDemoMode()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/signin");
}

/**
 * First-run onboarding. One security-definer RPC so household, owner
 * membership, and the 17 seeded lines commit atomically — a plain insert
 * couldn't even RETURN the household row under RLS (no membership yet).
 */
export async function createHousehold(householdName: string, displayName: string) {
  if (isDemoMode()) redirect("/");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  // Nothing about the RPC is idempotent — a double-clicked Create button would
  // build a second household and leave the user a member of both, with
  // getSupabaseStore free to pick either one on any given request.
  const { data: existing } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (existing) redirect("/");

  const { error } = await supabase.rpc("create_household_with_categories", {
    p_name: householdName.trim() || "Our household",
    p_display_name: displayName.trim() || (auth.user.email ?? "Member").split("@")[0],
    p_categories: DEFAULT_CATEGORIES,
  });
  if (error) throw error;

  redirect("/settings");
}

/** Consume a pending invite for the signed-in user's email. */
export async function acceptInvite(inviteId: string, displayName: string) {
  if (isDemoMode()) redirect("/");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  // maybeSingle, not single: an invite that was already consumed — a double
  // click, a stale tab, a back button — is a no-op to be absorbed, not a 500.
  const { data: invite, error } = await supabase
    .from("invites")
    .select("household_id, role")
    .eq("id", inviteId)
    .is("accepted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!invite) redirect("/");

  // The insert races itself when the Join button is double clicked, and
  // (household_id, user_id) is the primary key — so upsert and let the second
  // one land on the first instead of raising a duplicate-key error.
  const name = displayName.trim() || (auth.user.email ?? "Member").split("@")[0];
  const { error: memberError } = await supabase.from("household_members").upsert(
    {
      household_id: invite.household_id,
      user_id: auth.user.id,
      display_name: name,
      role: invite.role,
    },
    { onConflict: "household_id,user_id" },
  );
  if (memberError) throw memberError;

  const { error: acceptError } = await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (acceptError) throw acceptError;

  redirect("/");
}

export async function addSource(
  label: string,
  ownerMemberId?: string,
  kind?: SourceKind,
) {
  const store = await getStore();
  await store.createSource(label.trim(), await assertMember(store, ownerMemberId), kind);
  revalidatePath("/import");
  revalidatePath("/settings");
}

/**
 * The owner is client-supplied, so it must be one of this household's members —
 * never an arbitrary user id. Returns undefined to let the store default.
 */
async function assertMember(
  store: Awaited<ReturnType<typeof getStore>>,
  memberId?: string,
): Promise<string | undefined> {
  if (!memberId) return undefined;
  const household = await store.getHousehold();
  if (!household.members.some((m) => m.id === memberId)) {
    throw new Error("That person is not in this household");
  }
  return memberId;
}

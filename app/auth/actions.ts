"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStore, isDemoMode } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/data/default-categories";

/** Derived server-side — never trust a caller-supplied origin in an email redirect. */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; message: string }> {
  if (isDemoMode()) return { ok: false, message: "Demo mode has no sign-in — the data is seeded." };
  const supabase = await createClient();
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

  const { error } = await supabase.rpc("create_household_with_categories", {
    p_name: householdName,
    p_display_name: displayName,
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

  const { data: invite, error } = await supabase
    .from("invites")
    .select("household_id, role")
    .eq("id", inviteId)
    .is("accepted_at", null)
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: invite.household_id,
    user_id: auth.user.id,
    display_name: displayName,
    role: invite.role,
  });
  if (memberError) throw memberError;

  const { error: acceptError } = await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (acceptError) throw acceptError;

  redirect("/");
}

export async function addSource(label: string) {
  const store = await getStore();
  await store.createSource(label.trim());
  revalidatePath("/import");
  revalidatePath("/settings");
}

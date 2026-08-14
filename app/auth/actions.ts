"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getStore, isDemoMode } from "@/lib/data";
import { DEFAULT_CATEGORIES } from "@/lib/data/default-categories";

export async function sendMagicLink(
  email: string,
  origin: string,
): Promise<{ ok: boolean; message: string }> {
  if (isDemoMode()) return { ok: false, message: "Demo mode has no sign-in — the data is seeded." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
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

/** First-run onboarding: household + membership + the 17 seeded budget lines. */
export async function createHousehold(householdName: string, displayName: string) {
  if (isDemoMode()) redirect("/");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  const { data: household, error: hhError } = await supabase
    .from("households")
    .insert({ name: householdName })
    .select("id")
    .single();
  if (hhError) throw hhError;

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: auth.user.id,
    display_name: displayName,
    role: "owner",
  });
  if (memberError) throw memberError;

  const { error: catError } = await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map((c, i) => ({
      household_id: household.id,
      name: c.name,
      monthly_cap: c.monthlyCap,
      is_fixed: c.isFixed,
      sort_order: i,
    })),
  );
  if (catError) throw catError;

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

  await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inviteId);

  redirect("/");
}

export async function addSource(label: string) {
  const store = await getStore();
  await store.createSource(label.trim());
  revalidatePath("/import");
  revalidatePath("/settings");
}

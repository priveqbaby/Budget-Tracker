import { redirect } from "next/navigation";
import type { DataStore } from "./store";
import { DemoStore } from "./demo";

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

let demo: DemoStore | null = null;

/**
 * Demo store when Supabase env vars are absent (CLAUDE.md convention).
 * The Supabase store is loaded lazily so demo mode never touches its deps.
 * In live mode, callers without a session land on /signin and members-to-be
 * without a household land on /welcome.
 */
export async function getStore(): Promise<DataStore> {
  if (isDemoMode()) {
    if (!demo) demo = new DemoStore();
    return demo;
  }
  const { getSupabaseStore, NoHouseholdError, NotSignedInError } = await import("./supabase");
  try {
    return await getSupabaseStore();
  } catch (e) {
    if (e instanceof NotSignedInError) redirect("/signin");
    if (e instanceof NoHouseholdError) redirect("/welcome");
    throw e;
  }
}

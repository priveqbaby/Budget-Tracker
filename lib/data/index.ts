import type { DataStore } from "./store";
import { DemoStore } from "./demo";

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

let demo: DemoStore | null = null;

/**
 * Demo store when Supabase env vars are absent (CLAUDE.md convention).
 * The Supabase store is loaded lazily so demo mode never touches its deps.
 */
export async function getStore(): Promise<DataStore> {
  if (isDemoMode()) {
    if (!demo) demo = new DemoStore();
    return demo;
  }
  const { getSupabaseStore } = await import("./supabase");
  return getSupabaseStore();
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data";
import { WelcomeForms } from "@/components/welcome-forms";

/**
 * First sign-in: either accept a pending invite addressed to this email,
 * or create a new household (categories seeded from the 17 lines, editable).
 */
export default async function WelcomePage() {
  if (isDemoMode()) redirect("/");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  const { data: membership, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (membership) redirect("/");

  // RLS scopes this to invites addressed to the signed-in email; the
  // household name is denormalized on the invite row (see createInvite).
  const { data: invites } = await supabase
    .from("invites")
    .select("id, household_name")
    .is("accepted_at", null);

  const email = auth.user.email ?? "";
  const suggestedName = email.split("@")[0].replace(/[._-]+/g, " ");

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="card settle w-full max-w-[440px] px-8 py-9">
        <div className="font-display text-center text-[30px] font-semibold text-ink">
          Welcome to Hearth
        </div>
        <WelcomeForms
          suggestedName={suggestedName}
          invites={(invites ?? []).map((i) => ({
            id: i.id,
            householdName: i.household_name || "a household",
          }))}
        />
      </div>
    </div>
  );
}

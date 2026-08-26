import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/data";
import { AuthCallback } from "@/components/auth-callback";

/**
 * Magic-link landing. The session arrives in the URL fragment, which never
 * reaches the server — so the work happens in the client component, which
 * posts what it finds to /auth/session.
 */
/** Demo mode is an env-var question, so it must be asked per request. */
export const dynamic = "force-dynamic";

export default async function CallbackPage() {
  if (isDemoMode()) redirect("/");
  return <AuthCallback />;
}

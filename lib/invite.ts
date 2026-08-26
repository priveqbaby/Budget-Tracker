/**
 * Invites are addressed by email and consumed by comparing `lower(email)` —
 * both the RLS policies and `pending_invite_role` do. The unique constraint on
 * (household_id, email) does not lower anything, so an address typed with
 * different capitalisation slips past it and the invitee arrives at /welcome
 * with two identical Join buttons. Normalising on the way in is what makes the
 * constraint mean what it appears to mean.
 */
export function normalizeInviteEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  // Deliberately not RFC 5322 — this only has to reject a fat-fingered entry
  // before it becomes a row, not adjudicate exotic addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

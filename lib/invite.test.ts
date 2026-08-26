import { describe, it, expect } from "vitest";
import { normalizeInviteEmail } from "./invite";

describe("invite email normalization", () => {
  it("lowercases so the unique constraint catches the same person twice", () => {
    // unique (household_id, email) is case-sensitive, but every read compares
    // lower(email) — without this, both rows survive and the invitee sees two
    // identical Join buttons.
    expect(normalizeInviteEmail("Sara@Example.COM")).toBe("sara@example.com");
    expect(normalizeInviteEmail("sara@example.com")).toBe("sara@example.com");
  });

  it("trims what a paste leaves behind", () => {
    expect(normalizeInviteEmail("  sara@example.com \n")).toBe("sara@example.com");
    expect(normalizeInviteEmail("\tSARA@EXAMPLE.COM  ")).toBe("sara@example.com");
  });

  it("rejects entries that would become an invite nobody can accept", () => {
    for (const bad of ["", "   ", "sara", "sara@", "@example.com", "sara@example", "a b@c.com", "sara@ex ample.com"]) {
      expect(normalizeInviteEmail(bad)).toBeNull();
    }
  });

  it("keeps addresses that differ by more than case distinct", () => {
    expect(normalizeInviteEmail("sara+budget@example.com")).toBe("sara+budget@example.com");
    expect(normalizeInviteEmail("sara.b@example.co.uk")).toBe("sara.b@example.co.uk");
  });

  it("is idempotent — normalizing a normalized address changes nothing", () => {
    const once = normalizeInviteEmail("Sara@Example.com")!;
    expect(normalizeInviteEmail(once)).toBe(once);
  });
});

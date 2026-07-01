import { describe, expect, it } from "vitest";
import { isMetadataAdmin } from "@/lib/admin";

describe("metadata admin access", () => {
  it("allows only the HazzJC account by normalized username", () => {
    expect(isMetadataAdmin({ normalizedUsername: "hazzjc" })).toBe(true);
    expect(isMetadataAdmin({ normalizedUsername: "HazzJC" })).toBe(false);
    expect(isMetadataAdmin({ normalizedUsername: "another_user" })).toBe(false);
    expect(isMetadataAdmin(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isMetadataAdmin } from "@/lib/admin";

describe("metadata admin access", () => {
  it("uses an immutable role instead of a mutable username", () => {
    expect(isMetadataAdmin({ id: "admin", role: "METADATA_ADMIN" })).toBe(true);
    expect(isMetadataAdmin({ id: "user", role: "USER" })).toBe(false);
    expect(isMetadataAdmin(null)).toBe(false);
  });
});

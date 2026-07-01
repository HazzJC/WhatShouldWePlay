import { describe, expect, it } from "vitest";
import { maxAvatarBytes, validateAvatarBytes } from "@/lib/avatar";

describe("profile avatar validation", () => {
  it("accepts a small image with a matching file signature", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    expect(validateAvatarBytes(png, "image/png")).toMatchObject({
      success: true,
      mimeType: "image/png",
      sizeBytes: 9,
    });
  });

  it("rejects unsupported, oversized, and spoofed files", async () => {
    const text = new TextEncoder().encode("hello");
    const oversized = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const spoofed = new TextEncoder().encode("not a png");

    expect(validateAvatarBytes(text, "text/plain")).toMatchObject({ success: false });
    expect(validateAvatarBytes(oversized, "image/png", maxAvatarBytes + 1)).toMatchObject({ success: false });
    expect(validateAvatarBytes(spoofed, "image/png")).toMatchObject({ success: false });
  });
});

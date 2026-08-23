import { describe, expect, it } from "vitest";
import { MicrosoftAuthError, verifyMicrosoftUserInfo } from "@/lib/microsoft-auth";

describe("Microsoft auth", () => {
  it("maps an OIDC user profile", () => {
    expect(verifyMicrosoftUserInfo({
      sub: "microsoft-user-1",
      name: "Player One",
      preferred_username: "player@example.com",
    })).toEqual({
      sub: "microsoft-user-1",
      name: "Player One",
      email: "player@example.com",
      picture: null,
    });
  });

  it("rejects a profile without a stable subject", () => {
    expect(() => verifyMicrosoftUserInfo({ name: "No subject" })).toThrow(MicrosoftAuthError);
  });
});

import { describe, expect, it } from "vitest";
import { GoogleAuthError, verifyGoogleTokenInfo } from "@/lib/google-auth";

describe("Google token verification", () => {
  const validToken = {
    iss: "https://accounts.google.com",
    aud: "client-id",
    exp: String(Math.floor(Date.now() / 1000) + 60),
    sub: "google-user-1",
    email: "player@example.com",
    email_verified: "true",
    name: "Player One",
    picture: "https://example.com/avatar.png",
  };

  it("maps a valid verified Google token into a profile", () => {
    expect(verifyGoogleTokenInfo(validToken, "client-id")).toEqual({
      sub: "google-user-1",
      email: "player@example.com",
      emailVerified: true,
      name: "Player One",
      picture: "https://example.com/avatar.png",
    });
  });

  it("rejects invalid issuer, audience, expiry, missing subject, and unverified email", () => {
    expect(() => verifyGoogleTokenInfo({ ...validToken, iss: "https://evil.example" }, "client-id")).toThrow("issuer");
    expect(() => verifyGoogleTokenInfo({ ...validToken, aud: "other-client" }, "client-id")).toThrow("audience");
    expect(() => verifyGoogleTokenInfo({ ...validToken, exp: "1" }, "client-id")).toThrow("expired");
    expect(() => verifyGoogleTokenInfo({ ...validToken, sub: undefined }, "client-id")).toThrow("account id");
    expect(() => verifyGoogleTokenInfo({ ...validToken, email_verified: "false" }, "client-id")).toThrow("not verified");
  });

  it("exposes stable error codes for Google auth failures", () => {
    try {
      verifyGoogleTokenInfo({ ...validToken, aud: "other-client" }, "client-id");
      throw new Error("Expected verification to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleAuthError);
      expect((error as GoogleAuthError).code).toBe("invalid_audience");
    }
  });
});

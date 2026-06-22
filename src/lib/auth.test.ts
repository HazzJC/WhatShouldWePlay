import { describe, expect, it } from "vitest";
import { createOAuthState, parseOAuthState, signValue, verifySignedValue } from "@/lib/auth";

describe("signed cookie values", () => {
  const secret = "test-secret-value";

  it("round-trips a value with a valid signature", () => {
    const signed = signValue("participant-123", secret);
    expect(verifySignedValue(signed, secret)).toBe("participant-123");
  });

  it("rejects a tampered value", () => {
    const signed = signValue("participant-123", secret);
    const tampered = signed.replace("participant-123", "participant-999");
    expect(verifySignedValue(tampered, secret)).toBeNull();
  });

  it("rejects a value signed with a different secret", () => {
    const signed = signValue("participant-123", "other-secret");
    expect(verifySignedValue(signed, secret)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifySignedValue("no-signature", secret)).toBeNull();
    expect(verifySignedValue("", secret)).toBeNull();
  });

  it("round-trips OAuth state and rejects tampering", () => {
    const state = createOAuthState({
      shareToken: "share",
      participant: "participant",
      redirectTo: "/sessions/pick",
      intent: "signin",
    });

    expect(parseOAuthState(state)).toMatchObject({
      shareToken: "share",
      participant: "participant",
      redirectTo: "/sessions/pick",
      intent: "signin",
    });
    expect(parseOAuthState(`${state}tampered`)).toBeNull();
  });
});

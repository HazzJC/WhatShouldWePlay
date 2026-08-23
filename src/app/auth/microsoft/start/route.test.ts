import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildMicrosoftAuthUrl: vi.fn(),
  redirect: vi.fn(),
  rememberOAuthState: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  createOAuthState: vi.fn(() => "signed-state"),
  getCurrentUser: vi.fn(() => null),
  oauthParticipantForShareToken: vi.fn(() => undefined),
  rememberOAuthState: mocks.rememberOAuthState,
  safeInternalRedirect: vi.fn((path: string | null) => path || "/"),
}));

vi.mock("@/lib/microsoft-auth", () => ({
  buildMicrosoftAuthUrl: mocks.buildMicrosoftAuthUrl,
}));

import { GET } from "@/app/auth/microsoft/start/route";

describe("Microsoft auth start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildMicrosoftAuthUrl.mockResolvedValue("https://login.microsoftonline.com/authorize");
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("does not catch Next's successful redirect as a configuration error", async () => {
    await expect(GET(new Request("https://example.com/auth/microsoft/start?redirectTo=%2Faccount"))).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.rememberOAuthState).toHaveBeenCalledWith("signed-state");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("https://login.microsoftonline.com/authorize");
  });
});

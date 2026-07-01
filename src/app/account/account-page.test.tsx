import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "@/app/account/page";
import { getCurrentUser } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    participant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

describe("account page", () => {
  beforeEach(() => {
    mockedGetCurrentUser.mockReset();
  });

  it("asks signed-out users to sign in with Google", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    render(await AccountPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "You're signed out" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", expect.stringContaining("/auth/google/start"));
  });

  it("shows signed-in identity and Steam linking", async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: "user-1",
      displayName: "Player One",
      username: "player_one",
      normalizedUsername: "player_one",
      usernameChangedAt: new Date(),
      onboardingCompletedAt: new Date(),
      email: "player@example.com",
      emailVerified: true,
      avatarUrl: null,
      favouriteGenres: [],
      directoryVisible: true,
      lastSignedInAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      oauthAccounts: [
        {
          id: "oauth-1",
          provider: "GOOGLE",
          providerAccountId: "google-1",
          email: "player@example.com",
          emailVerified: true,
          avatarUrl: null,
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      steamAccount: null,
      preference: null,
    });

    render(await AccountPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Player One" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Steam" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect Steam" })).toHaveAttribute("href", expect.stringContaining("/auth/steam/start"));
  });
});

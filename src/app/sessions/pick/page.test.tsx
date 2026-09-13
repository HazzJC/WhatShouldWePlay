import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewPickSessionPage from "@/app/sessions/pick/page";
import { requireActivePickUser } from "@/lib/accounts";

vi.mock("@/app/actions", () => ({
  createPickSessionAction: vi.fn(),
  startPickSessionFromFriendGroupAction: vi.fn(),
}));

vi.mock("@/lib/accounts", () => ({
  requireActivePickUser: vi.fn(async () => ({ id: "user-1", displayName: "Player", timezone: "Europe/London" })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { friendGroup: { findMany: vi.fn(async () => []) } },
}));

describe("new Pick session query handoff", () => {
  it("keeps bounded player count and setup through the authentication return path and create form", async () => {
    render(await NewPickSessionPage({
      searchParams: Promise.resolve({ game: "rimworld", gameNight: "night-1", playerCount: "5", setup: "modded" }),
    }));

    const form = screen.getByRole("button", { name: "Create shortlist" }).closest("form");
    expect(form).not.toBeNull();
    const data = new FormData(form!);
    expect(data.get("initialGameSlug")).toBe("rimworld");
    expect(data.get("gameNightId")).toBe("night-1");
    expect(data.get("playerCount")).toBe("5");
    expect(data.get("setup")).toBe("modded");
    expect(requireActivePickUser).toHaveBeenCalledWith("/sessions/pick?game=rimworld&gameNight=night-1&playerCount=5&setup=modded");
  });
});

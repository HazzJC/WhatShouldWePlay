import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSession: vi.fn(),
  findSessionGames: vi.fn(),
  findUserGames: vi.fn(),
  findPriceAlertEvents: vi.fn(),
  findFriendInvite: vi.fn(),
  findFriends: vi.fn(),
  findFriendGroups: vi.fn(),
  findGames: vi.fn(),
  getCurrentUser: vi.fn(),
  getParticipantId: vi.fn(),
  getAppUrl: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("not found"); }) }));
vi.mock("@/app/actions", () => ({ joinPickWorkspaceAction: vi.fn(), lockSessionAction: vi.fn(), submitAvailabilityAction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: { findUnique: mocks.findSession }, sessionGame: { findMany: mocks.findSessionGames }, userGame: { findMany: mocks.findUserGames },
    priceAlertEvent: { findMany: mocks.findPriceAlertEvents }, friendInvite: { findFirst: mocks.findFriendInvite }, userFriend: { findMany: mocks.findFriends },
    friendGroup: { findMany: mocks.findFriendGroups }, game: { findMany: mocks.findGames }, userBlock: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.getCurrentUser, getParticipantId: mocks.getParticipantId }));
vi.mock("@/lib/accounts", () => ({
  isActivePickUser: (user: { id: string } | null) => Boolean(user),
  onboardingUrl: (returnTo: string) => `/account/onboarding?returnTo=${encodeURIComponent(returnTo)}`,
  signInUrl: (returnTo: string) => `/account/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: mocks.getAppUrl }));
vi.mock("@/lib/curated-games", () => ({ curatedGames: [] }));
vi.mock("@/lib/games", () => ({ commonMultiplayerGames: [], excludeExistingGames: vi.fn(() => []), rankSessionGames: vi.fn((games) => games), searchGamesCatalog: vi.fn(async () => []) }));
vi.mock("@/lib/group-buy", () => ({ defaultGroupBuyFilters: vi.fn((playerCount) => ({ budget: 0, genre: "all", playerCount, mode: "either", sessionLength: "one-night", platform: "all", avoidOwned: true, saleOnly: false })), scoreGroupBuyCandidates: vi.fn(() => []) }));
vi.mock("@/lib/igdb", () => ({ getPopularIgdbGames: vi.fn(async () => []), getTrendingIgdbGames: vi.fn(async () => []), mapIgdbGame: vi.fn() }));
vi.mock("@/lib/match-scoring", () => ({ scoreSessionGames: vi.fn(() => []) }));
vi.mock("@/lib/scheduling", () => ({
  formatSlotDay: vi.fn(), formatSlotRange: vi.fn(), formatSlotTime: vi.fn(), generateHourlySlots: vi.fn(() => []), isWeekendSlot: vi.fn(),
  rankBestTimes: vi.fn(() => []), rankMaybeTimes: vi.fn(() => []), responseMap: vi.fn(() => new Map()),
}));
vi.mock("@/components/availability-form", () => ({ AvailabilityForm: ({ participantId, participantName }: { participantId?: string; participantName?: string }) => <output data-testid="availability-form">{participantId ?? "visitor"}:{participantName ?? ""}</output> }));
vi.mock("@/components/pick-panel", () => ({ PickPanel: ({ currentUser, participantId, selectedParticipantIds }: { currentUser: { id: string } | null; participantId?: string; selectedParticipantIds: string[] }) => <output data-testid="pick-panel">{currentUser?.id ?? "visitor"}:{participantId}:{selectedParticipantIds.join(",")}</output> }));
vi.mock("@/components/post-import-status", () => ({ PostImportStatus: () => null }));
vi.mock("@/components/recommendations-disclosure", () => ({ RecommendationsDisclosure: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/session-tabs", () => ({ SessionTabs: ({ activeTab }: { activeTab: string }) => <output data-testid="session-tabs">{activeTab}</output> }));
vi.mock("@/components/share-panel", () => ({ SharePanel: () => null }));
vi.mock("@/components/pending-submit-button", () => ({ PendingSubmitButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button> }));

import SessionPage from "./page";

const planSession = {
  id: "plan-session", shareToken: "plan-token", title: "Friday co-op", workspaceType: "PLAN", mode: "ONLINE", requiredDuration: 2, minimumPlayerCount: 2,
  dateRangeStart: new Date("2026-09-11T00:00:00.000Z"), dateRangeEnd: new Date("2026-09-12T00:00:00.000Z"), dailyStartHour: 18, dailyEndHour: 22,
  timezone: "Europe/London", dealCountry: "GB", dealCurrency: "GBP", lockedStartTime: null, lockedEndTime: null, discordChannel: null, gameNight: null,
  participants: [{ id: "guest", userId: null, name: "Guest", isHost: true, createdAt: new Date(), responses: [], preference: null, user: null }],
};

const pickSession = {
  ...planSession, id: "pick-session", shareToken: "pick-token", title: "Library night", workspaceType: "PICK",
  gameNight: { shareToken: "night-token", selectedSessionGameId: null, workspaces: [{ shareToken: "plan-token", workspaceType: "PLAN" }, { shareToken: "pick-token", workspaceType: "PICK" }] },
  participants: [
    { id: "member", userId: "member-user", name: "Mina", isHost: true, createdAt: new Date(), responses: [], preference: null, user: { preference: null, steamAccount: null } },
    { id: "guest", userId: null, name: "Guest", isHost: false, createdAt: new Date(), responses: [], preference: null, user: null },
  ],
};

describe("shared session route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppUrl.mockResolvedValue("https://example.test"); mocks.getCurrentUser.mockResolvedValue(null); mocks.getParticipantId.mockResolvedValue(undefined);
    mocks.findSessionGames.mockResolvedValue([]); mocks.findUserGames.mockResolvedValue([]);
    mocks.findPriceAlertEvents.mockResolvedValue([]); mocks.findFriendInvite.mockResolvedValue(null); mocks.findFriends.mockResolvedValue([]); mocks.findFriendGroups.mockResolvedValue([]); mocks.findGames.mockResolvedValue([]);
  });

  it("composes the plan workspace for a cookie-identified visitor from an explicit session query", async () => {
    mocks.findSession.mockResolvedValue(planSession); mocks.getParticipantId.mockResolvedValue("guest");
    render(await SessionPage({ params: Promise.resolve({ shareToken: "plan-token" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Friday co-op" })).toBeInTheDocument();
    expect(screen.getByTestId("session-tabs")).toHaveTextContent("plan");
    expect(screen.getByTestId("availability-form")).toHaveTextContent("guest:Guest");
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce();
    expect(mocks.findSession).toHaveBeenCalledWith(expect.objectContaining({ where: { shareToken: "plan-token" } }));
  });

  it("composes the pick workspace for the signed-in member and loads its explicit data dependencies", async () => {
    mocks.findSession.mockResolvedValue(pickSession); mocks.getParticipantId.mockResolvedValue("guest");
    mocks.getCurrentUser.mockResolvedValue({ id: "member-user" });
    render(await SessionPage({ params: Promise.resolve({ shareToken: "pick-token" }), searchParams: Promise.resolve({ gameSearch: "spelunky" }) }));
    expect(screen.getByRole("heading", { name: "Library night" })).toBeInTheDocument(); expect(screen.getByTestId("session-tabs")).toHaveTextContent("pick");
    expect(screen.getByTestId("pick-panel")).toHaveTextContent("member-user:member:member,guest");
    expect(mocks.findSessionGames).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionId: "pick-session" } }));
    expect(mocks.findUserGames).toHaveBeenCalled(); expect(mocks.findGames).toHaveBeenCalled();
  });

  it("shows a join gate without loading private Pick data for a signed-in nonmember", async () => {
    mocks.findSession.mockResolvedValue(pickSession);
    mocks.getCurrentUser.mockResolvedValue({ id: "outside-user" });

    render(await SessionPage({ params: Promise.resolve({ shareToken: "pick-token" }), searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Join before viewing the group's games" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join this Pick" })).toBeInTheDocument();
    expect(screen.queryByTestId("pick-panel")).not.toBeInTheDocument();
    expect(mocks.findSessionGames).not.toHaveBeenCalled();
    expect(mocks.findUserGames).not.toHaveBeenCalled();
    expect(mocks.findGames).not.toHaveBeenCalled();
  });
});

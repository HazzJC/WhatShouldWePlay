/** Synthetic action-level evidence; expected failures must become normal tests after fixes. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addSessionGameAction } from "@/app/actions";
import { updateLibraryGameAction } from "@/app/account/actions";
import { upsertGame } from "@/lib/games";

const mocks = vi.hoisted(() => ({
  gameUpdate: vi.fn(), gameFindFirst: vi.fn(), gameUpsert: vi.fn(),
  userGameUpsert: vi.fn(), sessionGameUpsert: vi.fn(), signalUpsert: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: "u1", username: "audituser", onboardingCompletedAt: new Date("2026-01-01") }),
  resolveActingParticipantId: async () => "p1",
  safeInternalRedirect: (path: string) => path,
  getHostParticipantId: vi.fn(), setParticipantIdentity: vi.fn(), clearUserSession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  session: { findUnique: async () => ({ id: "s1", shareToken: "share", workspaceType: "PICK" }) },
  participant: { findFirst: async () => ({ id: "p1", userId: "u1" }) },
  game: {
    findUniqueOrThrow: async () => ({ id: "g1" }),
    findUnique: async () => null,
    findFirst: mocks.gameFindFirst,
    update: mocks.gameUpdate,
    upsert: mocks.gameUpsert,
  },
  sessionGame: { upsert: mocks.sessionGameUpsert },
  sessionGameSignal: { upsert: mocks.signalUpsert },
  userGame: { upsert: mocks.userGameUpsert },
  gameNight: { updateMany: async () => ({ count: 1 }) },
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessionGameUpsert.mockResolvedValue({ id: "sg1", gameId: "g1", addedByParticipantId: "p1", addedByUserId: "u1" });
  mocks.gameFindFirst.mockResolvedValue({ id: "g1", title: "Known title", onlineCoop: true, localCoop: true });
  mocks.gameUpdate.mockResolvedValue({ id: "g1" });
  mocks.gameUpsert.mockResolvedValue({ id: "g2" });
});

describe("dimension 1: known mutation defects at audit baseline", () => {
  it("F05: suggesting a game does not write persistent ownership", async () => {
    const form = new FormData();
    Object.entries({ shareToken: "share", participantId: "p1", title: "Suggested title", gameId: "g1", source: "MANUAL" }).forEach(([k, v]) => form.set(k, v));
    await addSessionGameAction(form);
    expect(mocks.sessionGameUpsert).toHaveBeenCalledOnce();
    expect(mocks.userGameUpsert).not.toHaveBeenCalled();
  });

  it("F12: a title-only add does not overwrite known co-op metadata with false", async () => {
    await upsertGame({ title: "Known title" });
    expect(mocks.gameUpdate).toHaveBeenCalledOnce();
    expect(mocks.gameUpdate.mock.calls[0][0].data.onlineCoop).toBeUndefined();
  });

  it("F12: generic multiplayer metadata is insufficient to assert co-op", async () => {
    await upsertGame({ title: "Synthetic versus game", steamAppId: 123, gameModes: ["Multiplayer"] });
    expect(mocks.gameUpsert).toHaveBeenCalledOnce();
    expect(mocks.gameUpsert.mock.calls[0][0].create.onlineCoop).not.toBe(true);
  });

  it("F14: clearing a rating writes null, not an omitted update", async () => {
    const form = new FormData();
    Object.entries({ gameId: "g1", ownership: "HAVE", rating: "", notes: "", interest: "NEUTRAL", playedStatus: "UNPLAYED" }).forEach(([k, v]) => form.set(k, v));
    await updateLibraryGameAction(form);
    expect(mocks.userGameUpsert).toHaveBeenCalledOnce();
    expect(mocks.userGameUpsert.mock.calls[0][0].update.rating).toBeNull();
  });

  it("F05: a curated Steam game can be shortlisted before it has been imported", async () => {
    const form = new FormData();
    Object.entries({ shareToken: "share", participantId: "p1", title: "PEAK", steamAppId: "3527290", source: "COMMON" }).forEach(([k, v]) => form.set(k, v));
    await expect(addSessionGameAction(form)).resolves.toBeUndefined();
    expect(mocks.gameUpsert).toHaveBeenCalledOnce();
    expect(mocks.sessionGameUpsert).toHaveBeenCalledOnce();
  });
});

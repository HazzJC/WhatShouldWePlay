import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitAvailabilityAction } from "@/app/actions";

const mocks = vi.hoisted(() => ({
  sessionFindUnique: vi.fn(),
  participantFindFirst: vi.fn(),
  participantUpdateMany: vi.fn(),
  participantCreate: vi.fn(),
  responseDeleteMany: vi.fn(),
  responseCreateMany: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: "user-1" }),
  resolveActingParticipantId: async () => "participant-1",
  safeInternalRedirect: (path: string) => path,
  setParticipantIdentity: vi.fn(),
}));
vi.mock("@/lib/scheduling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scheduling")>();
  return {
    ...actual,
    generateHourlySlots: () => [{
      startsAt: new Date("2026-09-11T18:00:00.000Z"),
      endsAt: new Date("2026-09-11T19:00:00.000Z"),
    }],
  };
});
vi.mock("@/lib/prisma", () => {
  const tx = {
    participant: { updateMany: mocks.participantUpdateMany, create: mocks.participantCreate },
    availabilityResponse: { deleteMany: mocks.responseDeleteMany, createMany: mocks.responseCreateMany },
  };
  return {
    prisma: {
      session: { findUnique: mocks.sessionFindUnique },
      participant: { findFirst: mocks.participantFindFirst },
      gameNight: { updateMany: vi.fn() },
      $transaction: async (work: (client: typeof tx) => unknown) => work(tx),
    },
  };
});

const session = {
  id: "session-1",
  shareToken: "share",
  workspaceType: "PLAN",
  dateRangeStart: new Date("2026-09-11T00:00:00.000Z"),
  dateRangeEnd: new Date("2026-09-11T00:00:00.000Z"),
  dailyStartHour: 18,
  dailyEndHour: 22,
  weekendStartHour: null,
  weekendEndHour: null,
  requiredDuration: 2,
  minimumPlayerCount: 2,
  timezone: "Europe/London",
};

describe("availability action integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionFindUnique.mockResolvedValue(session);
    mocks.participantFindFirst.mockResolvedValue({
      id: "participant-1",
      sessionId: "session-1",
      userId: "user-1",
      availabilityRevision: 2,
    });
  });

  it("validates every slot before creating or updating participant state", async () => {
    const form = baseForm();
    form.set("status:2026-09-11T20:00:00.000Z", "AVAILABLE");

    await expect(submitAvailabilityAction(null, form)).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(mocks.participantFindFirst).not.toHaveBeenCalled();
    expect(mocks.participantUpdateMany).not.toHaveBeenCalled();
    expect(mocks.participantCreate).not.toHaveBeenCalled();
  });

  it("returns a recoverable conflict before replacing responses from a stale revision", async () => {
    mocks.participantUpdateMany.mockResolvedValue({ count: 0 });
    const form = baseForm();
    form.set("status:2026-09-11T18:00:00.000Z", "MAYBE");

    await expect(submitAvailabilityAction(null, form)).resolves.toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(mocks.responseDeleteMany).not.toHaveBeenCalled();
    expect(mocks.responseCreateMany).not.toHaveBeenCalled();
  });
});

function baseForm() {
  const form = new FormData();
  form.set("shareToken", "share");
  form.set("participantId", "participant-1");
  form.set("participantName", "Player One");
  form.set("revision", "2");
  return form;
}

/** Known baseline failures. See domain.audit.test.ts and the audit handoff. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearUserSession, getHostParticipantId, resolveActingParticipantId, safeInternalRedirect, setParticipantIdentity, signValue } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  values: new Map<string, string>(),
  participantFindFirst: vi.fn(),
  participantFindUnique: vi.fn(),
  userSessionFindFirst: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (key: string) => mocks.values.has(key) ? { value: mocks.values.get(key) } : undefined,
  set: (key: string, value: string) => { mocks.values.set(key, value); },
  delete: (key: string) => { mocks.values.delete(key); },
}) }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  participant: { findFirst: mocks.participantFindFirst, findUnique: mocks.participantFindUnique },
  userSession: { findFirst: mocks.userSessionFindFirst, deleteMany: vi.fn() },
} }));

beforeEach(() => { mocks.values.clear(); vi.clearAllMocks(); });

describe("dimension 1: known identity defects at audit baseline", () => {
  it.fails("F01: ordinary participant refresh preserves an anonymous host grant", async () => {
    await setParticipantIdentity("s1", "host1", { isHost: true });
    expect(await getHostParticipantId("s1")).toBe("host1");
    // submitAvailabilityAction calls this without options after saving the name.
    await setParticipantIdentity("s1", "host1");
    expect(await getHostParticipantId("s1")).toBe("host1");
  });

  it.fails("F02: stale cookie cannot override the signed-in account's supplied membership", async () => {
    await setParticipantIdentity("s1", "old-user-participant");
    mocks.values.set("lpg_session", signValue("new-user-session-token"));
    mocks.userSessionFindFirst.mockResolvedValue({ user: { id: "new-user" } });
    mocks.participantFindFirst.mockResolvedValue({ id: "old-user-participant", userId: "old-user" });
    mocks.participantFindUnique.mockResolvedValue({ id: "new-user-participant" });
    // The resolver exits on cookie mismatch before it attempts account fallback.
    expect(await resolveActingParticipantId("s1", "new-user-participant")).toBe("new-user-participant");
  });

  it("F02 evidence: logout currently leaves a participant host grant in the browser", async () => {
    await setParticipantIdentity("s1", "host1", { isHost: true });
    await clearUserSession();
    expect(await getHostParticipantId("s1")).toBe("host1");
  });

  it.fails("F15: redirects remain same-origin after browser URL normalization", () => {
    const destination = safeInternalRedirect("/\\example.invalid/path");
    expect(new URL(destination, "https://app.invalid").origin).toBe("https://app.invalid");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { redeemDiscordHostHandoff } from "@/lib/discord-handoff";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  setParticipantIdentity: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  hashSessionToken: (token: string) => `hash:${token}`,
  setParticipantIdentity: mocks.setParticipantIdentity,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => unknown) => work({
      discordHostHandoff: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    }),
  },
}));

describe("Discord host handoff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically consumes a valid handoff before granting the host cookie", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "handoff-1",
      discordUserId: "discord-1",
      sessionId: "session-1",
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
      session: { id: "session-1", shareToken: "share" },
      participant: { id: "host-1", sessionId: "session-1", isHost: true, discordUserId: "discord-1" },
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    await expect(redeemDiscordHostHandoff("secret")).resolves.toBe("/s/share?participant=host-1");
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "handoff-1", redeemedAt: null }),
    }));
    expect(mocks.setParticipantIdentity).toHaveBeenCalledWith("session-1", "host-1", { isHost: true });
  });

  it("does not grant identity when the handoff has expired or lost its host binding", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "handoff-1",
      discordUserId: "discord-1",
      sessionId: "session-1",
      expiresAt: new Date(0),
      redeemedAt: null,
      session: { id: "session-1", shareToken: "share" },
      participant: { id: "host-1", sessionId: "session-1", isHost: true, discordUserId: "discord-1" },
    });

    await expect(redeemDiscordHostHandoff("expired")).resolves.toBeNull();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.setParticipantIdentity).not.toHaveBeenCalled();
  });
});

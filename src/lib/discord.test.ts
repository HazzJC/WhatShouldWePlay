import nacl from "tweetnacl";
import { describe, expect, it, vi } from "vitest";
import { discordCommandPayload, handleDiscordInteraction, normalizeReminderPreferences, reminderDueAt, verifyDiscordRequest } from "@/lib/discord";

const createSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => unknown) => work({
      session: { create: createSession },
      discordHostHandoff: { create: vi.fn() },
    }),
  },
}));
vi.mock("@/lib/app-url", () => ({ getAppUrl: async () => "https://games.example" }));
vi.mock("@/lib/discord-handoff", () => ({ createDiscordHostHandoff: async () => "creator-secret" }));

describe("discord helpers", () => {
  it("verifies valid Discord request signatures and rejects invalid ones", () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1780000000";
    const message = new Uint8Array(new TextEncoder().encode(`${timestamp}${body}`));
    const signature = nacl.sign.detached(message, keyPair.secretKey);

    expect(
      verifyDiscordRequest({
        body,
        timestamp,
        signature: toHex(signature),
        publicKey: toHex(keyPair.publicKey),
      }),
    ).toBe(true);
    expect(
      verifyDiscordRequest({
        body: `${body} `,
        timestamp,
        signature: toHex(signature),
        publicKey: toHex(keyPair.publicKey),
      }),
    ).toBe(false);
  });

  it("normalizes reminder choices and computes due times", () => {
    const reminders = normalizeReminderPreferences(["24 hours before", "2 hours before", "15 minutes before", "Custom:45"]);

    expect(reminders).toEqual([
      { label: "24 hours before", minutesBefore: 1440 },
      { label: "2 hours before", minutesBefore: 120 },
      { label: "15 minutes before", minutesBefore: 15 },
      { label: "Custom", minutesBefore: 45 },
    ]);
    expect(reminderDueAt(new Date("2026-06-20T20:00:00.000Z"), reminders[1]).toISOString()).toBe("2026-06-20T18:00:00.000Z");
    expect(normalizeReminderPreferences(["No reminders", "24 hours before"])).toEqual([]);
  });

  it("defines the letsplay slash command subcommands", () => {
    expect(discordCommandPayload.name).toBe("letsplay");
    expect(discordCommandPayload.options.map((option) => option.name)).toEqual(["create", "status", "remind", "games"]);
  });

  it("returns a Discord-created host handoff only in an ephemeral creator response", async () => {
    createSession.mockResolvedValue({
      id: "session-1",
      shareToken: "public-session",
      title: "Friday games",
      requiredDuration: 2,
      minimumPlayerCount: 4,
      participants: [{ id: "host-1", isHost: true, discordUserId: "discord-1" }],
      discordIntegrations: [],
    });

    const response = await handleDiscordInteraction({
      id: "interaction-1",
      type: 2,
      user: { id: "discord-1", username: "host" },
      data: { name: "letsplay", options: [{ name: "create", type: 1, options: [] }] },
    });
    const payload = await response.json() as { data: { flags?: number; content?: string } };

    expect(payload.data.flags).toBe(64);
    expect(payload.data.content).toContain("/s/public-session");
    expect(payload.data.content).toContain("/discord/handoff/creator-secret");
  });
});

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

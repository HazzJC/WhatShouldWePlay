import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { discordCommandPayload, normalizeReminderPreferences, reminderDueAt, verifyDiscordRequest } from "@/lib/discord";

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
});

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

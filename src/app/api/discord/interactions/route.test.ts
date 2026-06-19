import nacl from "tweetnacl";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/discord/interactions/route";

describe("Discord interactions route", () => {
  it("responds to signed Discord pings", async () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(3));
    const body = JSON.stringify({ type: 1 });
    const timestamp = "1780000000";
    const signature = nacl.sign.detached(new Uint8Array(new TextEncoder().encode(`${timestamp}${body}`)), keyPair.secretKey);
    const request = new Request("https://example.com/api/discord/interactions", {
      method: "POST",
      body,
      headers: {
        "x-signature-ed25519": toHex(signature),
        "x-signature-timestamp": timestamp,
      },
    });

    process.env.DISCORD_PUBLIC_KEY = toHex(keyPair.publicKey);
    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: 1 });
  });

  it("rejects unsigned Discord requests", async () => {
    const response = await POST(new Request("https://example.com/api/discord/interactions", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
  });
});

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { permittedPickParticipantIds } from "@/lib/pick/access";

const findBlocks = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: { userBlock: { findMany: findBlocks } },
}));

describe("Pick participant access", () => {
  beforeEach(() => findBlocks.mockReset());

  it("keeps the viewer and anonymous fallback while excluding blocked counterparts", async () => {
    findBlocks.mockResolvedValue([{ blockerId: "blocked-user", blockedId: "viewer" }]);
    await expect(permittedPickParticipantIds({
      viewerUserId: "viewer",
      participants: [
        { id: "self", userId: "viewer" },
        { id: "friend", userId: "friend-user" },
        { id: "blocked", userId: "blocked-user" },
        { id: "guest", userId: null },
      ],
    })).resolves.toEqual(["self", "friend", "guest"]);
  });
});

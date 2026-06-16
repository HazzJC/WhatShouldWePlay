import { describe, expect, it } from "vitest";
import { generateCandidateWindows, generateHourlySlots, rankBestTimes } from "./scheduling";

describe("scheduling", () => {
  const input = {
    dateRangeStart: "2026-06-19",
    dateRangeEnd: "2026-06-20",
    dailyStartHour: 18,
    dailyEndHour: 22,
    requiredDuration: 2,
    minimumPlayerCount: 1,
    timezone: "Europe/London",
  };

  it("generates one-hour slots across the inclusive date range", () => {
    const slots = generateHourlySlots(input);

    expect(slots).toHaveLength(8);
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-19T17:00:00.000Z");
    expect(slots[0].endsAt.toISOString()).toBe("2026-06-19T18:00:00.000Z");
  });

  it("excludes windows shorter than the required duration", () => {
    const windows = generateCandidateWindows(input);

    expect(windows).toHaveLength(6);
    expect(windows[0].slots).toHaveLength(2);
    expect(windows.at(-1)?.endsAt.toISOString()).toBe("2026-06-20T21:00:00.000Z");
  });

  it("uses separate weekend hours when provided", () => {
    const slots = generateHourlySlots({
      ...input,
      dailyStartHour: 18,
      dailyEndHour: 20,
      weekendStartHour: 12,
      weekendEndHour: 15,
    });

    expect(slots).toHaveLength(5);
    expect(slots[2].startsAt.toISOString()).toBe("2026-06-20T11:00:00.000Z");
  });

  it("ranks by available count, then maybe count, then time", () => {
    const [first, second] = generateHourlySlots(input);
    const ranked = rankBestTimes(input, [
      {
        participantId: "a",
        name: "Alex",
        responses: new Map([
          [first.startsAt.toISOString(), "AVAILABLE"],
          [second.startsAt.toISOString(), "AVAILABLE"],
        ]),
      },
      {
        participantId: "b",
        name: "Bea",
        responses: new Map([
          [first.startsAt.toISOString(), "AVAILABLE"],
          [second.startsAt.toISOString(), "MAYBE"],
        ]),
      },
    ]);

    expect(ranked[0]).toMatchObject({
      availableCount: 1,
      maybeCount: 1,
      unavailableCount: 0,
    });
  });

  it("only returns times that meet the minimum available players", () => {
    const [first, second, third] = generateHourlySlots(input);
    const ranked = rankBestTimes(
      { ...input, minimumPlayerCount: 2 },
      [
        {
          participantId: "a",
          name: "Alex",
          responses: new Map([
            [first.startsAt.toISOString(), "AVAILABLE"],
            [second.startsAt.toISOString(), "AVAILABLE"],
            [third.startsAt.toISOString(), "AVAILABLE"],
          ]),
        },
        {
          participantId: "b",
          name: "Bea",
          responses: new Map([
            [first.startsAt.toISOString(), "AVAILABLE"],
            [second.startsAt.toISOString(), "AVAILABLE"],
            [third.startsAt.toISOString(), "UNAVAILABLE"],
          ]),
        },
      ],
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ availableCount: 2, meetsMinimum: true });
  });
});

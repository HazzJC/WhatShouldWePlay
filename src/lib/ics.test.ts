import { describe, expect, it } from "vitest";
import { createIcsEvent } from "./ics";

describe("createIcsEvent", () => {
  it("creates a valid calendar event for a locked session", () => {
    const ics = createIcsEvent({
      title: "Friday Game Night",
      startsAt: new Date("2026-06-19T18:00:00.000Z"),
      endsAt: new Date("2026-06-19T20:00:00.000Z"),
      description: "Bring snacks, pick games.",
      url: "https://example.com/s/token",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Friday Game Night");
    expect(ics).toContain("DTSTART:20260619T180000Z");
    expect(ics).toContain("DTEND:20260619T200000Z");
    expect(ics).toContain("DESCRIPTION:Bring snacks\\, pick games.");
  });
});

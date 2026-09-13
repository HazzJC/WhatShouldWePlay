import { describe, expect, it } from "vitest";
import { parseLibraryPage } from "@/app/account/library/page";

describe("library pagination", () => {
  it("only permits bounded positive integer pages", () => {
    expect(parseLibraryPage("1")).toBe(1);
    expect(parseLibraryPage("250")).toBe(250);
    expect(parseLibraryPage("0")).toBe(1);
    expect(parseLibraryPage("-1")).toBe(1);
    expect(parseLibraryPage("2.5")).toBe(1);
    expect(parseLibraryPage("Infinity")).toBe(1);
    expect(parseLibraryPage("10001")).toBe(1);
  });
});

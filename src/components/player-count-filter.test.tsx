import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerCountFilter } from "@/components/player-count-filter";
import { parseMinimumPlayers } from "@/lib/player-count";

describe("PlayerCountFilter", () => {
  it("shows live exact player-count feedback from 1+ to 50+", () => {
    render(<PlayerCountFilter action="/discover" minimumPlayers={1} />);

    const slider = screen.getByRole("slider");
    expect(screen.getByText("1+")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "50" } });

    expect(screen.getByText("50+")).toBeInTheDocument();
  });

  it("parses player-count query values across the full range", () => {
    expect(parseMinimumPlayers("0")).toBe(1);
    expect(parseMinimumPlayers("17")).toBe(17);
    expect(parseMinimumPlayers("99")).toBe(50);
  });
});

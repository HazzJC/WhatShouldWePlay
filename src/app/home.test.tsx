import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("exposes distinct plan and pick starts", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /Plan a night/i })).toHaveAttribute("href", "/sessions/new");
    expect(screen.getByRole("link", { name: /Compare our games/i })).toHaveAttribute("href", "/sessions/pick");
  });
});

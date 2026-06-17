import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("exposes distinct plan and pick starts", () => {
    render(<Home />);

    expect(screen.getAllByRole("link", { name: /Plan/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Pick/i }).length).toBeGreaterThan(0);
  });
});

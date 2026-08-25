import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("planner entry", () => {
  it("puts the no-login planner first", () => {
    render(<Home />);

    expect(screen.getAllByText("Plan a night").length).toBeGreaterThan(0);
    expect(screen.getByText("Guests can answer without an account")).toBeInTheDocument();
    expect(screen.getByText("When can everyone make it?")).toBeInTheDocument();
    expect(screen.getByText("Deep Rock Galactic")).toBeInTheDocument();
  });
});

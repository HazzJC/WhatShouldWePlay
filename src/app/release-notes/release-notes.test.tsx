import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReleaseNotesPage from "@/app/release-notes/page";

describe("ReleaseNotesPage", () => {
  it("renders grouped reverse-chronological release notes and the future format", () => {
    render(<ReleaseNotesPage />);

    expect(screen.getByRole("heading", { name: "Release notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "July 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Persistent game profiles and account-first Pick" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "June 2026" })).toBeInTheDocument();
    expect(screen.getByText("22 June 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google accounts and reusable friend groups" })).toBeInTheDocument();
    expect(screen.getByText("18 June 2026")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Group game matching, deals, and discovery pages" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Initial game-night planner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Future entry format" })).toBeInTheDocument();
  });
});

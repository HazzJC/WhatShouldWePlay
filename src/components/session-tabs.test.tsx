import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionTabs } from "@/components/session-tabs";

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

describe("SessionTabs", () => {
  it("renders plan and pick tabs while preserving participant links", () => {
    render(<SessionTabs shareToken="abc" participantId="p1" activeTab="pick" />);

    expect(screen.getByRole("link", { name: "Plan" })).toHaveAttribute("href", "/s/abc?tab=plan&participant=p1");
    expect(screen.getByRole("link", { name: "Pick" })).toHaveAttribute("href", "/s/abc?tab=pick&participant=p1");
  });
});

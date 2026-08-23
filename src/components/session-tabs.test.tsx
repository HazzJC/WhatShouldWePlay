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
  it("disables a missing sibling workspace", () => {
    render(<SessionTabs shareToken="abc" participantId="p1" activeTab="pick" pickHref="/s/abc?tab=pick" />);

    expect(screen.queryByRole("link", { name: /Plan/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not set up")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick Compare libraries" })).toHaveAttribute("href", "/s/abc?tab=pick");
  });
});

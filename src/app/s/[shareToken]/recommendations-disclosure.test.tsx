import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecommendationsDisclosure } from "@/components/recommendations-disclosure";

describe("RecommendationsDisclosure", () => {
  it("is expanded by default for the host", () => {
    render(
      <RecommendationsDisclosure isCurrentHost={true} needsMoreSubmissions={false}>
        <p>Recommendation content</p>
      </RecommendationsDisclosure>,
    );

    expect(screen.getByTestId("recommendations-disclosure")).toHaveAttribute("open");
    expect(screen.getByText("Expanded for host")).toBeInTheDocument();
  });

  it("is collapsed by default for invited or anonymous users", () => {
    render(
      <RecommendationsDisclosure isCurrentHost={false} needsMoreSubmissions={false}>
        <p>Recommendation content</p>
      </RecommendationsDisclosure>,
    );

    expect(screen.getByTestId("recommendations-disclosure")).not.toHaveAttribute("open");
    expect(screen.getByText("Tap to view best times")).toBeInTheDocument();
  });
});

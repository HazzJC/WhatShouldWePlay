import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityForm } from "@/components/availability-form";

const groupedSlots = [
  {
    day: "Friday 19 June",
    toneIndex: 0,
    isWeekend: false,
    slots: [
      { key: "2026-06-19T18:00:00.000Z", time: "18:00-19:00", availableCount: 1, maybeCount: 0, totalCount: 2 },
      { key: "2026-06-19T19:00:00.000Z", time: "19:00-20:00", availableCount: 0, maybeCount: 1, totalCount: 2 },
    ],
  },
  {
    day: "Saturday 20 June",
    toneIndex: 1,
    isWeekend: true,
    slots: [
      { key: "2026-06-20T18:00:00.000Z", time: "18:00-19:00", availableCount: 2, maybeCount: 0, totalCount: 2 },
    ],
  },
];

describe("AvailabilityForm", () => {
  it("renders day-by-day wizard controls", () => {
    renderForm();

    const wizard = screen.getByLabelText("Availability day wizard");

    expect(within(wizard).getByText("Day 1 of 2")).toBeInTheDocument();
    expect(within(wizard).getByRole("button", { name: "Next day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save availability" })).toBeInTheDocument();
  });

  it("quick day actions update hidden status inputs", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();

    const wizard = screen.getByLabelText("Availability day wizard");
    await user.click(within(wizard).getByRole("button", { name: /All in/i }));

    expect(statusInput(container, "2026-06-19T18:00:00.000Z")).toHaveValue("AVAILABLE");
    expect(statusInput(container, "2026-06-19T19:00:00.000Z")).toHaveValue("AVAILABLE");
    expect(statusInput(container, "2026-06-20T18:00:00.000Z")).toBeNull();
  });
});

function renderForm() {
  return render(
    <AvailabilityForm
      action={vi.fn()}
      shareToken="share-token"
      participantName="Alex"
      groupedSlots={groupedSlots}
      currentResponses={{}}
      compact={false}
    />,
  );
}

function statusInput(container: HTMLElement, slotKey: string) {
  return container.querySelector<HTMLInputElement>(`input[name="status:${slotKey}"]`);
}

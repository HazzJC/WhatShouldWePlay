import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("does not submit a queued fill-blanks request after unmounting", async () => {
    vi.useFakeTimers();
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, "requestSubmit");
    const view = renderForm();

    fireEvent.submit(view.container.querySelector("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Fill blanks as Maybe" }));
    view.unmount();

    vi.runAllTimers();
    expect(requestSubmit).not.toHaveBeenCalled();
    requestSubmit.mockRestore();
  });

  it("keeps an unsaved availability draft when server responses refresh", async () => {
    const user = userEvent.setup();
    const view = renderForm();
    const wizard = screen.getByLabelText("Availability day wizard");

    await user.click(within(wizard).getByRole("button", { name: /All in/i }));
    view.rerender(
      <AvailabilityForm
        action={vi.fn()}
        shareToken="share-token"
        participantName="Alex"
        revision={4}
        groupedSlots={groupedSlots}
        currentResponses={{ "2026-06-19T18:00:00.000Z": "UNAVAILABLE" }}
        compact={false}
      />,
    );

    expect(statusInput(view.container, "2026-06-19T18:00:00.000Z")).toHaveValue("AVAILABLE");
    expect(view.container.querySelector<HTMLInputElement>('input[name="revision"]')).toHaveValue("0");
  });

  it("submits the revision and retains the draft when the server reports a conflict", async () => {
    const conflictAction = vi.fn(async () => ({
      ok: false as const,
      code: "CONFLICT" as const,
      message: "This availability was updated in another tab. Your draft is still here; refresh to compare before saving again.",
    }));
    const user = userEvent.setup();
    const view = renderForm({ action: conflictAction, revision: 7 });

    await user.click(within(screen.getByLabelText("Availability day wizard")).getByRole("button", { name: /All in/i }));
    await user.click(screen.getByRole("button", { name: "Next day" }));
    await user.click(within(screen.getByLabelText("Availability day wizard")).getByRole("button", { name: /All in/i }));
    await user.click(screen.getByRole("button", { name: "Save availability" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("updated in another tab"));
    const [, submittedData] = conflictAction.mock.calls[0] as unknown as [unknown, FormData];
    expect(submittedData.get("revision")).toBe("7");
    expect(submittedData.get("status:2026-06-19T18:00:00.000Z")).toBe("AVAILABLE");
    expect(statusInput(view.container, "2026-06-19T18:00:00.000Z")).toHaveValue("AVAILABLE");
  });

  it("keeps repeated DST wall-hour labels distinct when a zone is supplied", () => {
    renderForm({
      groupedSlots: [{
        ...groupedSlots[0],
        slots: [
          { ...groupedSlots[0].slots[0], time: "01:00-01:00 BST" },
          { ...groupedSlots[0].slots[1], time: "01:00-01:00 GMT" },
        ],
      }],
    });

    expect(screen.getByLabelText("Time 01:00-01:00 BST")).toBeInTheDocument();
    expect(screen.getByLabelText("Time 01:00-01:00 GMT")).toBeInTheDocument();
  });
});

function renderForm({
  action = vi.fn(),
  revision = 0,
  groupedSlots: slots = groupedSlots,
}: {
  action?: Parameters<typeof AvailabilityForm>[0]["action"];
  revision?: number;
  groupedSlots?: typeof groupedSlots;
} = {}) {
  return render(
    <AvailabilityForm
      action={action}
      shareToken="share-token"
      participantName="Alex"
      revision={revision}
      groupedSlots={slots}
      currentResponses={{}}
      compact={false}
    />,
  );
}

function statusInput(container: HTMLElement, slotKey: string) {
  return container.querySelector<HTMLInputElement>(`input[name="status:${slotKey}"]`);
}

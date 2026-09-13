import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameSignalControls } from "@/components/game-signal-controls";

const actionMocks = vi.hoisted(() => ({
  markGameAvailableAction: vi.fn(),
  markGameInterestAction: vi.fn(),
}));

vi.mock("@/app/actions", () => actionMocks);

describe("GameSignalControls", () => {
  beforeEach(() => {
    actionMocks.markGameAvailableAction.mockReset();
    actionMocks.markGameInterestAction.mockReset();
  });

  it("serializes conflicting signal writes until the active mutation settles", async () => {
    let resolveSave: () => void = () => undefined;
    actionMocks.markGameAvailableAction.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole("button", { name: "Have" }));

    expect(screen.getByRole("button", { name: "Don't have" })).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Don't have" }));
    expect(actionMocks.markGameAvailableAction).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Have" })).not.toBeDisabled();
  });

  it("does not let an old server prop overwrite a confirmed optimistic signal", async () => {
    actionMocks.markGameAvailableAction.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    const view = renderControls();

    await user.click(screen.getByRole("button", { name: "Have" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());

    view.rerender(
      <GameSignalControls
        shareToken="share"
        participantId="participant"
        sessionGameId="game"
        initialSignal={null}
        initialInterest="NEUTRAL"
      />,
    );

    expect(screen.getByRole("button", { name: "Have" })).toHaveClass("bg-moss");
  });
});

function renderControls() {
  return render(
    <GameSignalControls
      shareToken="share"
      participantId="participant"
      sessionGameId="game"
      initialSignal={null}
      initialInterest="NEUTRAL"
    />,
  );
}

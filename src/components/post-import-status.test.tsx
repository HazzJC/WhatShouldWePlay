import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostImportStatus } from "@/components/post-import-status";

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("PostImportStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    router.refresh.mockReset();
    router.replace.mockReset();
    window.history.replaceState({}, "", "/s/share?tab=pick&imported=2");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its one-shot refresh functional in Strict Mode and cleans it up", () => {
    render(
      <StrictMode>
        <PostImportStatus importedCount={2} />
      </StrictMode>,
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Recommendations are ready below/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(router.replace).toHaveBeenCalledWith("/s/share?tab=pick", { scroll: false });
  });

  it("does not leave refresh timers behind after unmount", () => {
    const view = render(<PostImportStatus importedCount={1} />);
    view.unmount();

    vi.runAllTimers();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

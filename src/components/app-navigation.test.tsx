import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "@/components/app-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/discover",
}));

describe("AppNavigation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("keeps the theme selector visible in the shared header", () => {
    render(<AppNavigation />);

    const selector = screen.getByRole("group", { name: "Quick colour theme" });
    expect(selector).toBeInTheDocument();
    expect(selector).toHaveTextContent("LightDarkSystem");
  });

  it("changes and remembers the theme without opening the account menu", async () => {
    const user = userEvent.setup();
    render(<AppNavigation />);
    const selector = screen.getByRole("group", { name: "Quick colour theme" });

    await user.click(within(selector).getByRole("button", { name: "Dark" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("theme-mode")).toBe("dark");
  });
});

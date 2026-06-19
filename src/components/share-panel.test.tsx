import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SharePanel } from "@/components/share-panel";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,abc"),
  },
}));

describe("SharePanel", () => {
  it("shows all sharing options and preserves the active tab URL", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });
    render(<SharePanel title="Game night" url="https://example.com/s/share?tab=pick" />);

    await userEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share to Discord" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Share to WhatsApp" })).toHaveAttribute("href", expect.stringContaining("tab%3Dpick"));
    expect(screen.getByRole("link", { name: "Share to Messenger" })).toHaveAttribute("href", expect.stringContaining("tab%3Dpick"));
    expect(screen.getByRole("link", { name: "Share by email" })).toHaveAttribute("href", expect.stringContaining("tab%3Dpick"));
    expect(screen.getByText("QR code")).toBeInTheDocument();
  });
});

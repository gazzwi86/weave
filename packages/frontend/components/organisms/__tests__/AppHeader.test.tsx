import { render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "../AppHeader";

describe("AppHeader", () => {
  it("renders the breadcrumb slot", () => {
    render(<AppHeader breadcrumb={<span>Constitution / Overview</span>} />);
    expect(screen.getByText("Constitution / Overview")).toBeInTheDocument();
  });

  it("hides the sidebar-expand button when the sidebar is not collapsed", () => {
    render(<AppHeader breadcrumb="x" sidebarCollapsed={false} onExpandSidebar={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /expand sidebar/i })).not.toBeInTheDocument();
  });

  it("shows the sidebar-expand button when collapsed, and it fires the handler", async () => {
    const onExpandSidebar = vi.fn();
    render(<AppHeader breadcrumb="x" sidebarCollapsed onExpandSidebar={onExpandSidebar} />);
    const button = screen.getByRole("button", { name: /expand sidebar/i });
    expect(button.querySelector("svg")).toBeInTheDocument();
    // refit-mock.html #sidebar-expand-btn title="Show sidebar" -- native
    // hover hint alongside the existing aria-label (Law 3: fill the gap,
    // don't touch the aria-label already there).
    expect(button).toHaveAttribute("title", "Show sidebar");
    await userEvent.click(button);
    expect(onExpandSidebar).toHaveBeenCalledTimes(1);
  });

  it("fires onOpenCommandBar when the command bar is clicked", async () => {
    const onOpenCommandBar = vi.fn();
    render(<AppHeader breadcrumb="x" onOpenCommandBar={onOpenCommandBar} />);
    await userEvent.click(screen.getByRole("button", { name: /search, ask, or jump to/i }));
    expect(onOpenCommandBar).toHaveBeenCalledTimes(1);
  });

  it("renders notifications, help, and account slots", () => {
    render(
      <AppHeader
        breadcrumb="x"
        notifications={<span>notif-slot</span>}
        help={<span>help-slot</span>}
        account={<span>account-slot</span>}
      />
    );
    expect(screen.getByText("notif-slot")).toBeInTheDocument();
    expect(screen.getByText("help-slot")).toBeInTheDocument();
    expect(screen.getByText("account-slot")).toBeInTheDocument();
  });

});

describe("AppHeader New split button", () => {
  it("omits the New split button when no action is wired (no dead CTA)", () => {
    render(<AppHeader breadcrumb="x" />);
    expect(screen.queryByRole("button", { name: /^New$/i })).not.toBeInTheDocument();
  });

  it("renders the New split button with a separate caret action when wired", async () => {
    const onNewAction = vi.fn();
    const onNewMore = vi.fn();
    render(<AppHeader breadcrumb="x" onNewAction={onNewAction} onNewMore={onNewMore} />);

    await userEvent.click(screen.getByRole("button", { name: "New" }));
    expect(onNewAction).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /new — more options/i }));
    expect(onNewMore).toHaveBeenCalledTimes(1);
  });

  it("hints the New split button's purpose on hover (refit-mock.html #global-new)", () => {
    render(<AppHeader breadcrumb="x" onNewAction={vi.fn()} />);
    const mainButton = screen.getByRole("button", { name: "New" });
    expect(mainButton.closest("div")).toHaveAttribute("title", "New model entity");
  });
});

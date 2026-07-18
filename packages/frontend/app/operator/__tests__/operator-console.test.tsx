import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { OperatorConsole } from "../operator-console";

describe("OperatorConsole", () => {
  beforeEach(() => {
    // jsdom has no real <dialog> support -- same polyfill as
    // app/build/__tests__/new-project-modal.test.tsx.
    HTMLDialogElement.prototype.showModal ??= function mockShowModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function mockClose(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("renders the tenant KPI stat cards from the stub seed", () => {
    render(<OperatorConsole />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("companies")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("members across tenants")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.getByText("audit chains valid")).toBeInTheDocument();
  });

  it("renders the isolation explain-band", () => {
    render(<OperatorConsole />);

    expect(screen.getByText(/You are outside any company/)).toBeInTheDocument();
  });

  it("renders one row per seeded tenant with company, counts and status", () => {
    render(<OperatorConsole />);

    const row = screen.getByText("Hammerbarn").closest("tr");
    expect(row).not.toBeNull();
    const scoped = within(row as HTMLElement);
    expect(scoped.getByText("retail · ap-southeast-2")).toBeInTheDocument();
    expect(scoped.getByText("14")).toBeInTheDocument();
    expect(scoped.getByText("1,240")).toBeInTheDocument();
    expect(scoped.getByText("v14")).toBeInTheDocument();
    expect(scoped.getByText("active")).toBeInTheDocument();
  });

  it("suspends an active tenant and hides its Suspend action", async () => {
    const user = userEvent.setup();
    render(<OperatorConsole />);

    const row = screen.getByText("Hammerbarn").closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Suspend" }));

    expect(within(row).getByText("suspended")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("does not offer Suspend for an onboarding tenant, only Open", () => {
    render(<OperatorConsole />);

    const row = screen.getByText("Northwind Logistics").closest("tr") as HTMLElement;
    expect(within(row).getByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("provisions a new company via the dialog and lists it as onboarding", async () => {
    const user = userEvent.setup();
    render(<OperatorConsole />);

    await user.click(screen.getByRole("button", { name: "Provision company" }));
    await user.type(screen.getByLabelText("Company name"), "New Co");
    await user.click(screen.getByRole("button", { name: "Provision" }));

    const row = screen.getByText("New Co").closest("tr") as HTMLElement;
    expect(within(row).getByText("onboarding")).toBeInTheDocument();
  });
});

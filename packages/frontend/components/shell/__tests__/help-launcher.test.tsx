import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HelpLauncher } from "../help-launcher";

describe("HelpLauncher", () => {
  it("opens a contextual help panel without navigating away (AC-7)", () => {
    render(<HelpLauncher />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
  });

  it("closes when dismissed", () => {
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close help/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

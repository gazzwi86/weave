import { axe } from "vitest-axe";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PathPickerDialog } from "../path-picker-dialog";

describe("PathPickerDialog (AC-006-02/04)", () => {
  it("stays closed when not open", () => {
    render(<PathPickerDialog open={false} current="business" onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a selectable option for each of the 4 onboarding paths", () => {
    render(<PathPickerDialog open={true} current="business" onChoose={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    for (const label of ["Business", "Technical", "Compliance", "Admin"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("calls onChoose with the selected path", () => {
    const onChoose = vi.fn();
    render(<PathPickerDialog open={true} current="business" onChoose={onChoose} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    expect(onChoose).toHaveBeenCalledWith("technical");
  });

  it("calls onCancel when the viewer cancels", () => {
    const onCancel = vi.fn();
    render(<PathPickerDialog open={true} current="business" onChoose={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("has no axe violations when open", async () => {
    const { container } = render(
      <PathPickerDialog open={true} current="business" onChoose={vi.fn()} onCancel={vi.fn()} />
    );
    expect((await axe(container)).violations).toHaveLength(0);
  });
});

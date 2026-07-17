import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityPickerModal, type EntityPickerOption } from "../EntityPickerModal";

const options: EntityPickerOption[] = [
  { id: "e1", label: "Onboard vendor", kind: "process", kindLabel: "Process" },
  { id: "e2", label: "Compliance officer", kind: "actor", kindLabel: "Actor" },
];

function renderModal(overrides: Partial<React.ComponentProps<typeof EntityPickerModal>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const onToggle = vi.fn();
  const onSearchChange = vi.fn();
  render(
    <EntityPickerModal
      open
      onClose={onClose}
      onConfirm={onConfirm}
      options={options}
      selectedIds={[]}
      onToggle={onToggle}
      search={{ value: "", onChange: onSearchChange }}
      {...overrides}
    />
  );
  return { onClose, onConfirm, onToggle, onSearchChange };
}

describe("EntityPickerModal", () => {
  it("caps the option list height and scrolls overflow (JSDOM cannot exercise real scroll)", () => {
    const many: EntityPickerOption[] = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`, label: `Entity ${i}`, kind: "process" as const, kindLabel: "Process",
    }));
    renderModal({ options: many });
    const list = screen.getByRole("listbox");
    expect(list.className).toContain("max-h-[var(--size-picker-list-max)]");
    expect(list.className).toContain("overflow-y-auto");
  });


  it("renders nothing when closed", () => {
    render(
      <EntityPickerModal
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        options={options}
        selectedIds={[]}
        onToggle={vi.fn()}
        search={{ value: "", onChange: vi.fn() }}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a row per option with its kind label", () => {
    renderModal();
    expect(screen.getByText("Onboard vendor")).toBeInTheDocument();
    expect(screen.getByText("Compliance officer")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Actor")).toBeInTheDocument();
  });

  it("marks preselected rows as pressed/selected", () => {
    renderModal({ selectedIds: ["e1"] });
    expect(screen.getByRole("option", { name: /Onboard vendor/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Compliance officer/ })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onToggle with the row id when a row is clicked", () => {
    const { onToggle } = renderModal();
    fireEvent.click(screen.getByRole("option", { name: /Onboard vendor/ }));
    expect(onToggle).toHaveBeenCalledWith("e1");
  });

  it("calls onSearchChange as the search input changes", () => {
    const { onSearchChange } = renderModal();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "vendor" } });
    expect(onSearchChange).toHaveBeenCalledWith("vendor");
  });

  it("calls onClose on Cancel and onConfirm with selectedIds on Confirm", () => {
    const { onClose, onConfirm } = renderModal({ selectedIds: ["e2"] });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith(["e2"]);
  });
});

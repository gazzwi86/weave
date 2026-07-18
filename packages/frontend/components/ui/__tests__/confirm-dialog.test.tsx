import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../confirm-dialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ConfirmDialog
      open
      entityType="workspace"
      entityName="Hammerbarn"
      consequence="This can't be undone."
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { onCancel, onConfirm };
}

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        entityType="workspace"
        entityName="Hammerbarn"
        consequence="This can't be undone."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the Delete <type> \"<name>\"? title and consequence body when open", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText('Delete workspace "Hammerbarn"?')).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("is a modal dialog (aria-modal, focus trapped by Radix)", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("calls onCancel, not onConfirm, when Cancel is clicked", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm, not onCancel, when the danger confirm button is clicked", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("supports a custom confirm label", () => {
    renderDialog({ confirmLabel: "Remove" });
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("calls onCancel on Escape (Radix's built-in close)", async () => {
    // Same real document-level path as Drawer -- fireEvent.keyDown(dialog)
    // never reaches Radix's dismissable-layer listener.
    const { onCancel } = renderDialog();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("pins the recomposed structure -- Title/Description render within the ModalShell dialog and are announced", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: 'Delete workspace "Hammerbarn"?' });
    expect(dialog).toHaveAccessibleDescription("This can't be undone.");
  });
});

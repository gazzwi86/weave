import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { Drawer } from "../Drawer";

function renderDrawer(overrides: Partial<React.ComponentProps<typeof Drawer>> = {}) {
  const onClose = vi.fn();
  render(
    <Drawer open icon="pencil" tone="var(--color-accent-primary)" title="Edit entity" onClose={onClose} {...overrides}>
      <p>Body content</p>
    </Drawer>
  );
  return { onClose };
}

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(
      <Drawer open={false} icon="pencil" tone="var(--color-accent-primary)" title="Edit entity" onClose={vi.fn()}>
        <p>Body content</p>
      </Drawer>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, pill, and body when open", () => {
    renderDrawer({ pill: <span>TASK-008</span> });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit entity")).toBeInTheDocument();
    expect(screen.getByText("TASK-008")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("is a modal dialog (aria-modal, focus trapped by Radix)", () => {
    renderDrawer();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when the icon-only close button is clicked", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape (Radix's built-in close)", async () => {
    // Radix's dismissable-layer listens for Escape at the document level, not
    // on the dialog node -- fireEvent.keyDown(dialog, ...) never reaches it.
    // userEvent.keyboard dispatches the real document-level keydown.
    const { onClose } = renderDrawer();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders footer actions right-aligned and a left danger slot when given", () => {
    renderDrawer({
      footer: <button type="button">Save</button>,
      dangerSlot: <button type="button">Delete</button>,
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("renders no footer bar when neither footer nor dangerSlot are given", () => {
    renderDrawer();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("applies the width variant class for the given size", () => {
    renderDrawer({ size: "doc" });
    expect(screen.getByRole("dialog").className).toMatch(/size-drawer-doc/);
  });
});

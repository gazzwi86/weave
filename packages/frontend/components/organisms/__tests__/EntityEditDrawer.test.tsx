import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityEditDrawer } from "../EntityEditDrawer";

function renderDrawer(overrides: Partial<React.ComponentProps<typeof EntityEditDrawer>> = {}) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onLabelChange = vi.fn();
  const onDescriptionChange = vi.fn();
  render(
    <EntityEditDrawer
      open
      title="Edit kind — Process"
      icon="tag"
      tone="var(--color-accent-primary)"
      label="Process"
      onLabelChange={onLabelChange}
      description="A repeatable series of activities."
      onDescriptionChange={onDescriptionChange}
      onClose={onClose}
      onSave={onSave}
      {...overrides}
    />
  );
  return { onClose, onSave, onLabelChange, onDescriptionChange };
}

describe("EntityEditDrawer", () => {
  it("renders label and description fields with current values", () => {
    renderDrawer();
    expect(screen.getByLabelText("Label")).toHaveValue("Process");
    expect(screen.getByLabelText("Description")).toHaveValue("A repeatable series of activities.");
  });

  it("renders the description hint", () => {
    renderDrawer();
    expect(screen.getByText("Shown in tooltips, the canvas legend and AI grounding.")).toBeInTheDocument();
  });

  it("fires onLabelChange/onDescriptionChange as the caller-controlled fields change", () => {
    const { onLabelChange, onDescriptionChange } = renderDrawer();
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Sub-process" } });
    expect(onLabelChange).toHaveBeenCalledWith("Sub-process");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "New description" } });
    expect(onDescriptionChange).toHaveBeenCalledWith("New description");
  });

  it("renders no delete button and no relationships section by default", () => {
    renderDrawer();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Relationships")).not.toBeInTheDocument();
  });

  it("renders a danger Delete button wired to onDelete when given", () => {
    const onDelete = vi.fn();
    renderDrawer({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders the optional kindFields slot when given", () => {
    renderDrawer({ kindFields: <div>Colour swatches</div> });
    expect(screen.getByText("Colour swatches")).toBeInTheDocument();
  });

  it("renders the optional relationships section when given", () => {
    renderDrawer({ relationships: <div>Rel editor</div> });
    expect(screen.getByText("Relationships")).toBeInTheDocument();
    expect(screen.getByText("Rel editor")).toBeInTheDocument();
  });

  it("calls onClose on Cancel and onSave on Save changes", () => {
    const { onClose, onSave } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

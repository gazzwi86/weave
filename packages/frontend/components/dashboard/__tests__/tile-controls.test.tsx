import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TileControls } from "../tile-controls";

describe("TileControls", () => {
  it("H1: shows only Pin (not Unpin) when the widget is not yet pinned (showPin=true)", () => {
    render(
      <TileControls
        title="Entities in model"
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        showPin={true}
      />
    );

    expect(screen.getByRole("button", { name: /pin entities in model/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^unpin/i })).not.toBeInTheDocument();
  });

  it("H1: shows only Unpin (not Pin) when the widget is already pinned (showPin=false)", () => {
    render(
      <TileControls
        title="Entities in model"
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        showPin={false}
      />
    );

    expect(screen.getByRole("button", { name: /unpin entities in model/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^pin/i })).not.toBeInTheDocument();
  });

  it("H1: every rendered control is a real button with an accessible name (not bare text)", () => {
    render(
      <TileControls
        title="Entities in model"
        onPin={vi.fn()}
        onUnpin={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onPublish={vi.fn()}
        showPin={true}
      />
    );

    const buttons = screen.getAllByRole("button");
    // Move up/down/Pin/Publish -- Unpin is hidden while showPin=true.
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button).toHaveAccessibleName();
    }
  });

  it("omits a control entirely when its handler is not supplied", () => {
    render(<TileControls title="Entities in model" showPin={true} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

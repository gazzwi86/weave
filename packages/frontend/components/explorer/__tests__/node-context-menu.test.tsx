import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NodeContextMenu } from "../node-context-menu";

describe("NodeContextMenu", () => {
  it("renders nothing when there is no open position", () => {
    render(
      <NodeContextMenu
        position={null}
        canFocusDomain={true}
        isExpanded={false}
        onFocusDomain={vi.fn()}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  // AC-3: "Focus domain" only offered for domain-kind nodes.
  it("offers Focus domain only when canFocusDomain is true", () => {
    const { rerender } = render(
      <NodeContextMenu
        position={{ x: 10, y: 20 }}
        canFocusDomain={false}
        isExpanded={false}
        onFocusDomain={vi.fn()}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("menuitem", { name: /focus domain/i })).not.toBeInTheDocument();

    rerender(
      <NodeContextMenu
        position={{ x: 10, y: 20 }}
        canFocusDomain={true}
        isExpanded={false}
        onFocusDomain={vi.fn()}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("menuitem", { name: /focus domain/i })).toBeInTheDocument();
  });

  // AC-3/AC-5: exactly one of Expand/Collapse is offered, based on state.
  it("offers Expand neighbours when not yet expanded, and calls onExpand + onClose on select", () => {
    const onExpand = vi.fn();
    const onClose = vi.fn();
    render(
      <NodeContextMenu
        position={{ x: 10, y: 20 }}
        canFocusDomain={false}
        isExpanded={false}
        onFocusDomain={vi.fn()}
        onExpand={onExpand}
        onCollapse={vi.fn()}
        onClose={onClose}
      />
    );
    expect(screen.queryByRole("menuitem", { name: /collapse neighbours/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /expand neighbours/i }));

    expect(onExpand).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers Collapse neighbours when already expanded, and calls onCollapse + onClose on select", () => {
    const onCollapse = vi.fn();
    const onClose = vi.fn();
    render(
      <NodeContextMenu
        position={{ x: 10, y: 20 }}
        canFocusDomain={false}
        isExpanded={true}
        onFocusDomain={vi.fn()}
        onExpand={vi.fn()}
        onCollapse={onCollapse}
        onClose={onClose}
      />
    );
    expect(screen.queryByRole("menuitem", { name: /expand neighbours/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /collapse neighbours/i }));

    expect(onCollapse).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onFocusDomain + onClose when Focus domain is selected", () => {
    const onFocusDomain = vi.fn();
    const onClose = vi.fn();
    render(
      <NodeContextMenu
        position={{ x: 10, y: 20 }}
        canFocusDomain={true}
        isExpanded={false}
        onFocusDomain={onFocusDomain}
        onExpand={vi.fn()}
        onCollapse={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("menuitem", { name: /focus domain/i }));

    expect(onFocusDomain).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

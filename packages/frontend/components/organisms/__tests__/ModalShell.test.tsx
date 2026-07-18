import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalShell } from "../ModalShell";

describe("ModalShell", () => {
  it("renders nothing when closed", () => {
    render(
      <ModalShell open={false} onClose={vi.fn()}>
        <p>Body</p>
      </ModalShell>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders children when open, as a modal dialog", () => {
    render(
      <ModalShell open onClose={vi.fn()}>
        <p>Body</p>
      </ModalShell>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <ModalShell open onClose={onClose}>
        <p>Body</p>
      </ModalShell>
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("applies the width variant class for the given size", () => {
    render(
      <ModalShell open onClose={vi.fn()} size="lg">
        <p>Body</p>
      </ModalShell>
    );
    expect(screen.getByRole("dialog").className).toMatch(/size-modal-lg/);
  });

  it("defaults to the sm width", () => {
    render(
      <ModalShell open onClose={vi.fn()}>
        <p>Body</p>
      </ModalShell>
    );
    expect(screen.getByRole("dialog").className).toMatch(/max-w-\[var\(--size-modal\)\]/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerKeyBindings } from "../key-bindings";

function fireKeydown(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true }));
}

describe("registerKeyBindings", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fits the canvas on Cmd/Ctrl+0 when the canvas container holds focus", () => {
    const container = document.createElement("div");
    const input = document.createElement("input");
    container.appendChild(input);
    document.body.appendChild(container);
    input.focus();

    const fit = vi.fn();
    const unregister = registerKeyBindings({ container: () => container, fit });

    fireKeydown(document, { key: "0", metaKey: true });

    expect(fit).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("does NOT call fit or preventDefault when the canvas container does not contain activeElement (AC-7)", () => {
    const container = document.createElement("div");
    const outsideInput = document.createElement("input");
    document.body.appendChild(container);
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    const fit = vi.fn();
    const unregister = registerKeyBindings({ container: () => container, fit });

    const event = new KeyboardEvent("keydown", { key: "0", metaKey: true, bubbles: true, cancelable: true });
    const wasDefaultPrevented = !document.dispatchEvent(event);

    expect(fit).not.toHaveBeenCalled();
    expect(wasDefaultPrevented).toBe(false);
    unregister();
  });

  // QA edge case: the shortcut is Cmd/Ctrl+0, not bare "0" -- a plain digit
  // keypress (e.g. typing into a canvas-focused search chip) must not fit.
  it("does NOT call fit on a plain '0' keypress without Cmd/Ctrl, even when the canvas holds focus", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.tabIndex = -1;
    container.focus();

    const fit = vi.fn();
    const unregister = registerKeyBindings({ container: () => container, fit });

    fireKeydown(document, { key: "0" });

    expect(fit).not.toHaveBeenCalled();
    unregister();
  });

  it("removes its keydown listener once unregistered", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.tabIndex = -1;
    container.focus();

    const fit = vi.fn();
    const unregister = registerKeyBindings({ container: () => container, fit });
    unregister();

    fireKeydown(document, { key: "0", metaKey: true });

    expect(fit).not.toHaveBeenCalled();
  });
});

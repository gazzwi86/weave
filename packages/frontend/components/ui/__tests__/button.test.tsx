import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../button";

// AC-2 (TASK-027): components.md's Button spec is a closed
// primary/secondary/ghost/danger set -- ghost was missing before this task,
// which is what let bespoke non-token buttons creep into page chrome.
describe("Button ghost variant", () => {
  it("renders the ghost variant with no border and muted text, per components.md", () => {
    render(<Button variant="ghost">Sign out</Button>);
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.className).toContain("text-[var(--color-text-muted)]");
    expect(button.className).not.toContain("border");
  });
});

// refit-mock.html `.btn-danger{color:#fff}` -- fixed white text on the
// danger fill, not the text-follows-bg trick the other variants use.
describe("Button danger variant", () => {
  it("renders white text via the --color-on-danger token", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("text-[var(--color-on-danger)]");
  });
});

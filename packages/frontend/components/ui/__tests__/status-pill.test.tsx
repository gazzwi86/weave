import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "../status-pill";

describe("StatusPill", () => {
  it.each(["active", "published", "draft", "custom"] as const)(
    "renders the %s label",
    (status) => {
      render(<StatusPill status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    }
  );

  it("tints active/published with the success colour", () => {
    render(<StatusPill status="published" />);
    expect(screen.getByText("published").className).toContain("--color-success");
  });

  it("tints draft with the warn colour", () => {
    render(<StatusPill status="draft" />);
    expect(screen.getByText("draft").className).toContain("--color-warn");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChainStatusChip } from "../chain-status-chip";

describe("ChainStatusChip", () => {
  it("renders the valid-chain label and links to the given href", () => {
    render(<ChainStatusChip status="valid" href="/audit/compliance" />);
    const link = screen.getByRole("link", { name: /chain valid/i });
    expect(link).toHaveAttribute("href", "/audit/compliance");
  });

  it("tints valid with the success colour", () => {
    render(<ChainStatusChip status="valid" href="/audit/compliance" />);
    expect(screen.getByRole("link").className).toContain("--color-success");
  });

  it("renders the broken-chain label and tints with the danger colour", () => {
    render(<ChainStatusChip status="broken" href="/audit/compliance" />);
    const link = screen.getByRole("link", { name: /chain broken/i });
    expect(link.className).toContain("--color-danger");
  });
});

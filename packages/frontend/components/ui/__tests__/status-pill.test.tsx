import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "../status-pill";

describe("StatusPill", () => {
  it.each(["active", "published", "draft", "custom", "onboarding", "suspended"] as const)(
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

  it("tints draft/onboarding with the warn colour", () => {
    render(<StatusPill status="draft" />);
    expect(screen.getByText("draft").className).toContain("--color-warn");
    render(<StatusPill status="onboarding" />);
    expect(screen.getByText("onboarding").className).toContain("--color-warn");
  });

  it("tints suspended with the danger colour", () => {
    render(<StatusPill status="suspended" />);
    expect(screen.getByText("suspended").className).toContain("--color-danger");
  });

  // BLD registry cards (refit-mock.html #sub-bld-registry) need the pill's
  // own vocabulary ("building"/"live"/"archived") rather than the generic
  // active/published/draft/custom set -- `label` overrides the rendered
  // text while `status` still drives the tone.
  it("renders an overriding label while keeping the status's tone", () => {
    render(<StatusPill status="active" label="building" />);
    const pill = screen.getByText("building");
    expect(pill).toBeInTheDocument();
    expect(pill.className).toContain("--color-success");
    expect(screen.queryByText("active")).not.toBeInTheDocument();
  });
});

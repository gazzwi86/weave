import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { StandardForm } from "../standard-form";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("StandardForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-004-01: fields mirror TASK-003's BrandStandardShape (contentType,
  // body-or-source toggle, effectiveDate, owner) -- hardcoded (ADR-022:
  // not fetchable via the BPMO catalogue), not free-hand.
  it("renders the fields TASK-003's BrandStandardShape requires", () => {
    render(<StandardForm onCommitted={vi.fn()} />);
    expect(screen.getByLabelText(/content type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/effective date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content body/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/link to a source/i));
    expect(screen.getByLabelText(/^source url/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<StandardForm onCommitted={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });

  // AC-004-01: on success shows the committed version + PROV-O actor.
  it("commits the standard via CE-WRITE-1 and shows the version + actor on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/session")) {
          return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
        }
        return jsonResponse(201, {
          activity_iri: "urn:a1",
          applied_count: 1,
          version_iri: "urn:weave:tenant:t:ws:w:v0.0.2",
          ref_map: { form1: "urn:weave:instances:bs-1" },
        });
      })
    );
    const onCommitted = vi.fn();
    render(<StandardForm onCommitted={onCommitted} />);

    fireEvent.change(screen.getByLabelText(/content type/i), { target: { value: "acme.tone" } });
    fireEvent.change(screen.getByLabelText(/content body/i), { target: { value: "Be direct." } });
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/^owner/i), { target: { value: "Brand Team" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onCommitted).toHaveBeenCalledWith("urn:weave:instances:bs-1"));
    expect(await screen.findByText(/urn:weave:tenant:t:ws:w:v0.0.2/)).toBeInTheDocument();
    expect(await screen.findByText(/brand-owner@example.com/)).toBeInTheDocument();
  });

  // AC-004-01: a 422 field-anchors, mirroring the guided-form pattern.
  it("maps a 422 violation onto its field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/session")) {
          return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
        }
        return jsonResponse(422, {
          violations: [
            {
              focus_node: "_:b1",
              path: "https://weave.io/ontology/owner",
              severity: "Violation",
              message: "Every BrandStandard must have exactly one owner.",
            },
          ],
        });
      })
    );
    render(<StandardForm onCommitted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/content type/i), { target: { value: "acme.tone" } });
    fireEvent.change(screen.getByLabelText(/content body/i), { target: { value: "Be direct." } });
    fireEvent.change(screen.getByLabelText(/effective date/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/^owner/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/Every BrandStandard must have exactly one owner\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/^owner/i)).toHaveAttribute("aria-invalid", "true");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { GuidedForm } from "../guided-form";

const PROCESS_KIND = {
  iri: "urn:weave:kind:Process",
  label: "Process",
  properties: [
    {
      path: "urn:weave:prop:owner",
      name: "Owner",
      is_relationship: false,
      min_count: 1,
      max_count: 1,
      severity: "Violation",
    },
  ],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(handler: (url: string) => Response): void {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => handler(String(input))));
}

function stubTypesAnd(applyResponse: () => Response): void {
  stubFetch((url) => {
    if (url.includes("/api/ontology/types")) {
      return jsonResponse(200, { kinds: [PROCESS_KIND], relationships: [] });
    }
    return applyResponse();
  });
}

async function fillAndSubmit(owner: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(/^label/i), { target: { value: "Customer Onboarding" } });
  if (owner) fireEvent.change(screen.getByLabelText(/owner/i), { target: { value: owner } });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
}

describe("GuidedForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubTypesAnd(() => jsonResponse(201, {}));
    const { container } = render(<GuidedForm kindIri={PROCESS_KIND.iri} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/owner/i)).toBeInTheDocument());
    expect((await axe(container)).violations).toHaveLength(0);
  });

  // AC-006-07
  it("renders fields derived from the kind's SHACL shape", async () => {
    stubTypesAnd(() => jsonResponse(201, {}));
    render(<GuidedForm kindIri={PROCESS_KIND.iri} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/owner/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/^label/i)).toBeInTheDocument();
  });

  // AC-006-08
  it("blocks submit and highlights a required field left empty", async () => {
    const applyMock = vi.fn(() => jsonResponse(201, {}));
    stubTypesAnd(applyMock);
    render(<GuidedForm kindIri={PROCESS_KIND.iri} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/owner/i)).toBeInTheDocument());

    await fillAndSubmit("");

    expect(await screen.findByText(/owner.*required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/owner/i)).toHaveAttribute("aria-invalid", "true");
    expect(applyMock).not.toHaveBeenCalled();
  });

  // AC-006-09
  it("submits successfully and shows the committed IRI with a view-in-graph link", async () => {
    stubTypesAnd(() =>
      jsonResponse(201, {
        activity_iri: "urn:a",
        applied_count: 1,
        version_iri: "urn:v1",
        ref_map: { form1: "urn:weave:process:1" },
      })
    );
    render(<GuidedForm kindIri={PROCESS_KIND.iri} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/owner/i)).toBeInTheDocument());

    await fillAndSubmit("urn:weave:person:1");

    const link = await screen.findByRole("link", { name: /view in graph/i });
    expect(link).toHaveAttribute("href", `/explorer?focus=${encodeURIComponent("urn:weave:process:1")}`);
  });

  // AC-006-10
  it("maps a 422 SHACL violation back onto its form field", async () => {
    stubTypesAnd(() =>
      jsonResponse(422, {
        violations: [
          {
            focus_node: "urn:weave:process:1",
            path: "urn:weave:prop:owner",
            severity: "Violation",
            message: "Owner must be a Person",
          },
        ],
      })
    );
    render(<GuidedForm kindIri={PROCESS_KIND.iri} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/owner/i)).toBeInTheDocument());

    await fillAndSubmit("urn:weave:notaperson:1");

    expect(await screen.findByText(/Owner must be a Person/)).toBeInTheDocument();
    expect(screen.getByLabelText(/owner/i)).toHaveAttribute("aria-invalid", "true");
  });
});

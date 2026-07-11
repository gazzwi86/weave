import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { VoiceRuleForm } from "../voice-rule-form";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(applyResponse: () => Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/session")) {
        return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
      }
      return applyResponse();
    })
  );
}

describe("VoiceRuleForm", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-004-02: requires severity + a machine-evaluable assertion field --
  // rendered as a type-select + value, not free text (Implementation Hints).
  it("renders rule id, severity select, and an assertion type-select + value", () => {
    render(<VoiceRuleForm onCommitted={vi.fn()} />);
    expect(screen.getByLabelText(/rule id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assertion type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/assertion value/i)).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<VoiceRuleForm onCommitted={vi.fn()} />);
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("commits the rule via CE-WRITE-1 (assertion composed from type + value)", async () => {
    let capturedBody: { operations: { properties?: Record<string, string> }[] } = { operations: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/auth/session")) {
          return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
        }
        capturedBody = JSON.parse(String(init?.body));
        return jsonResponse(201, {
          activity_iri: "urn:a1",
          applied_count: 1,
          version_iri: "urn:v1",
          ref_map: { form1: "urn:weave:instances:vr-1" },
        });
      })
    );
    const onCommitted = vi.fn();
    render(<VoiceRuleForm onCommitted={onCommitted} />);

    fireEvent.change(screen.getByLabelText(/rule id/i), { target: { value: "no-jargon" } });
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: "critical" } });
    fireEvent.change(screen.getByLabelText(/assertion type/i), { target: { value: "forbidden-term" } });
    fireEvent.change(screen.getByLabelText(/assertion value/i), { target: { value: "synergy" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onCommitted).toHaveBeenCalledWith("urn:weave:instances:vr-1"));
    expect(capturedBody.operations[0]?.properties?.["https://weave.io/ontology/assertion"]).toBe(
      "forbidden-term:synergy"
    );
  });

  // AC-004-02: missing assertion surfaces the SHACL 422 field-anchored.
  it("field-anchors a missing-assertion 422", async () => {
    stubFetch(() =>
      jsonResponse(422, {
        violations: [
          {
            focus_node: "_:b1",
            path: "https://weave.io/ontology/assertion",
            severity: "Violation",
            message: "Every VoiceRule must have a machine-evaluable assertion.",
          },
        ],
      })
    );
    render(<VoiceRuleForm onCommitted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/rule id/i), { target: { value: "no-jargon" } });
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: "critical" } });
    // The server is the source of truth even for a value that looks fine
    // client-side (client `required` only blocks the truly-empty case).
    fireEvent.change(screen.getByLabelText(/assertion value/i), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(
      await screen.findByText(/Every VoiceRule must have a machine-evaluable assertion\./)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/assertion value/i)).toHaveAttribute("aria-invalid", "true");
  });

  // EDGE CASE (QA, TASK-004): handleSubmit has no try/finally around
  // submitAddNode (unlike app/ce/chat/guided-form.tsx's reference pattern),
  // so a thrown/rejected fetch (network failure, or a non-JSON error body
  // res.json() can't parse) skips setSubmitting(false). Save stays disabled
  // forever with no error shown and no retry short of a full page reload
  // (which loses the user's typed values). RED repro test: documents the
  // current (broken) behavior; should start passing once the Engineer wraps
  // the await in try/finally.
  it("re-enables Save after a network failure so the user can retry (regression repro)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/session")) {
          return jsonResponse(200, { user: { email: "brand-owner@example.com" } });
        }
        throw new TypeError("Failed to fetch");
      })
    );
    render(<VoiceRuleForm onCommitted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/rule id/i), { target: { value: "no-jargon" } });
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: "critical" } });
    fireEvent.change(screen.getByLabelText(/assertion type/i), { target: { value: "forbidden-term" } });
    fireEvent.change(screen.getByLabelText(/assertion value/i), { target: { value: "synergy" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    // BUG: currently never re-enables -- setSubmitting(false) is skipped
    // when submitAddNode throws.
    await waitFor(() => expect(saveButton).not.toBeDisabled(), { timeout: 2000 });
  });
});

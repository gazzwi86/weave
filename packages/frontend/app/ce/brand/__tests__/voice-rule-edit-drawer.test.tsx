import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceRuleEditDrawer } from "../voice-rule-edit-drawer";
import type { VoiceRuleRow } from "../types";

const ROW: VoiceRuleRow = {
  iri: "urn:weave:instances:vr-1",
  ruleId: "no-jargon",
  severity: "critical",
  assertion: "forbidden-term:synergy",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("VoiceRuleEditDrawer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefills every field from the row, decomposing the assertion", () => {
    render(<VoiceRuleEditDrawer row={ROW} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByLabelText(/rule id/i)).toHaveValue("no-jargon");
    expect(screen.getByLabelText(/severity/i)).toHaveValue("critical");
    expect(screen.getByLabelText(/assertion type/i)).toHaveValue("forbidden-term");
    expect(screen.getByLabelText(/assertion value/i)).toHaveValue("synergy");
  });

  it("saves an edit via update_node and calls onSaved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, { version_iri: "urn:weave:tenant:t:ws:w:v0.0.4" })));
    const onSaved = vi.fn();
    render(<VoiceRuleEditDrawer row={ROW} onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/assertion value/i), { target: { value: "leverage" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("urn:weave:instances:vr-1"));
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as {
      operations: { op: string; iri: string; properties: Record<string, string> }[];
    };
    expect(body.operations[0]).toMatchObject({ op: "update_node", iri: "urn:weave:instances:vr-1" });
    expect(body.operations[0]!.properties["https://weave.io/ontology/assertion"]).toBe("forbidden-term:leverage");
  });

  it("deletes via a ConfirmDialog, not a bare click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, {})));
    const onDeleted = vi.fn();
    render(<VoiceRuleEditDrawer row={ROW} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("urn:weave:instances:vr-1"));
  });
});

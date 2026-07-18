import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StandardEditDrawer } from "../standard-edit-drawer";
import type { BrandStandardRow } from "../types";

const ROW: BrandStandardRow = {
  iri: "urn:weave:instances:bs-1",
  contentType: "acme.tone",
  contentBody: "Be direct.",
  sourceUri: null,
  effectiveDate: "2026-01-01",
  owner: "Brand Team",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("StandardEditDrawer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // AC: EntityEditDrawer-pattern CRUD -- the existing row's values are
  // shown, not a blank create form (mirrors AuthoringDrawer's "edit" mode).
  it("prefills every field from the row", () => {
    render(<StandardEditDrawer row={ROW} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.getByLabelText(/content type/i)).toHaveValue("acme.tone");
    expect(screen.getByLabelText(/content body/i)).toHaveValue("Be direct.");
    expect(screen.getByLabelText(/effective date/i)).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(/^owner/i)).toHaveValue("Brand Team");
  });

  it("saves an edit via update_node and calls onSaved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(201, { version_iri: "urn:weave:tenant:t:ws:w:v0.0.3" }))
    );
    const onSaved = vi.fn();
    render(<StandardEditDrawer row={ROW} onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^owner/i), { target: { value: "New Owner" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("urn:weave:instances:bs-1"));
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as { operations: { op: string; iri: string }[] };
    expect(body.operations[0]).toMatchObject({ op: "update_node", iri: "urn:weave:instances:bs-1" });
  });

  // Danger-slot Delete -> ConfirmDialog -> submitDeleteNode, same shape
  // as every other delete affordance in the app (ConfirmDialog convention).
  it("deletes via a ConfirmDialog, not a bare click", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(201, {})));
    const onDeleted = vi.fn();
    render(<StandardEditDrawer row={ROW} onClose={vi.fn()} onSaved={vi.fn()} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]!);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("urn:weave:instances:bs-1"));
  });
});

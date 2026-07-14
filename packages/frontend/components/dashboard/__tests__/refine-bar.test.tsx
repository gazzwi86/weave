import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RefineBar } from "../refine-bar";

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const SPEC_EVENT =
  'event: spec\ndata: {"component_type":"bar_chart","title":"Entities by kind, last 30 days",' +
  '"data_source_contracts":["CE-METRICS-1"],"bindings":{"field":"entity_count_by_kind"},"column_span":6}\n\n';
const DATA_EVENT = 'event: data\ndata: {"rows":{"Person":12},"partial":false}\n\n';
const DONE_EVENT = 'event: done\ndata: {"token_count":42,"widget_id":"w-1"}\n\n';

describe("RefineBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // AC-5: refine on an unpinned (no `widgetId`) widget holds context
  // client-side -- no `/refine` (or any) network call. Mirrors
  // `change-viz.test.tsx::test_change_viz_no_refetch`'s identical
  // widgetId?-branch precedent (TASK-012).
  it("test_unpinned_refine_client_held: no network call when widgetId is absent", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const onRefined = vi.fn();

    render(<RefineBar onRefined={onRefined} />);
    fireEvent.change(screen.getByLabelText("Refine this widget"), {
      target: { value: "split by severity" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine" }));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it("posts to the widget's refine endpoint and reports the result when pinned", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([SPEC_EVENT, DATA_EVENT, DONE_EVENT])
    );
    vi.stubGlobal("fetch", fetchSpy);
    const onRefined = vi.fn();

    render(<RefineBar widgetId="w-1" onRefined={onRefined} />);
    fireEvent.change(screen.getByLabelText("Refine this widget"), {
      target: { value: "split by severity" },
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Refine" }));
    });

    await waitFor(() => expect(onRefined).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/dashboard/widgets/w-1/refine");
    expect(onRefined.mock.calls[0]?.[0]).toMatchObject({ title: "Entities by kind, last 30 days" });
  });
});

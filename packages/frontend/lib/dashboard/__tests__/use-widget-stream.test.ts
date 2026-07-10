import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWidgetStream } from "../use-widget-stream";

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

const SPEC_EVENT = 'event: spec\ndata: {"component_type":"kpi_card","title":"T",' +
  '"data_source_contracts":["CE-METRICS-1"],"bindings":{},"column_span":3}\n\n';
const DATA_EVENT = 'event: data\ndata: {"rows":[1,2],"partial":false}\n\n';
const DONE_EVENT = 'event: done\ndata: {"token_count":42,"widget_id":"w-1"}\n\n';
const ERROR_EVENT = 'event: error\ndata: {"state":"budget_cap","reason":"cap reached"}\n\n';

describe("useWidgetStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts idle", () => {
    const { result } = renderHook(() => useWidgetStream());
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("transitions idle -> streaming -> done across the SSE grammar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse([SPEC_EVENT, DATA_EVENT, DONE_EVENT]))
    );
    const { result } = renderHook(() => useWidgetStream());

    act(() => {
      result.current.generate("show entities");
    });

    await waitFor(() => expect(result.current.state.status).toBe("done"));
    expect(result.current.state).toMatchObject({
      status: "done",
      tokenCount: 42,
      widgetId: "w-1",
      rows: [[1, 2]],
    });
  });

  it("surfaces a terminal error event as an error state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([ERROR_EVENT])));
    const { result } = renderHook(() => useWidgetStream());

    act(() => {
      result.current.generate("show entities");
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      status: "error",
      errorState: "budget_cap",
      reason: "cap reached",
    });
  });

  it("passes an AbortSignal so unmount can cancel the stream", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([SPEC_EVENT, DONE_EVENT])
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { result, unmount } = renderHook(() => useWidgetStream());

    act(() => {
      result.current.generate("show entities");
    });
    unmount();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

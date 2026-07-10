"use client";

import { useCallback, useRef, useState } from "react";

import type { SseErrorState, WidgetSpec } from "@/components/dashboard/types";

import { parseSseEvents } from "./parse-sse-events";

export type WidgetStreamState =
  | { status: "idle" }
  | { status: "streaming"; spec: WidgetSpec; rows: unknown[] }
  | { status: "done"; spec: WidgetSpec; rows: unknown[]; tokenCount: number; widgetId: string }
  | { status: "error"; errorState: SseErrorState; reason: string; spec?: WidgetSpec };

/** Consumes `POST /api/dashboard/widgets/generate` (TASK-011). Uses
 * `fetch` + `ReadableStream`, not `EventSource` -- it can't POST
 * (Implementation Hints). Aborts the in-flight request on unmount so the
 * server generator sees the disconnect and doesn't leak its transaction.
 */
export function useWidgetStream(): {
  state: WidgetStreamState;
  generate: (prompt: string) => void;
} {
  const [state, setState] = useState<WidgetStreamState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback((prompt: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "idle" });
    void streamGenerate(prompt, controller.signal, setState);
  }, []);

  return { state, generate };
}

async function streamGenerate(
  prompt: string,
  signal: AbortSignal,
  setState: (updater: (prev: WidgetStreamState) => WidgetStreamState) => void
): Promise<void> {
  const response = await fetch("/api/dashboard/widgets/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    const { events, remainder } = parseSseEvents(decoder.decode(value, { stream: true }), buffered);
    buffered = remainder;
    for (const event of events) applyEvent(event, setState);
  }
}

function applyEvent(
  event: ReturnType<typeof parseSseEvents>["events"][number],
  setState: (updater: (prev: WidgetStreamState) => WidgetStreamState) => void
): void {
  if (event.event === "spec") {
    setState(() => ({ status: "streaming", spec: event.data, rows: [] }));
  } else if (event.event === "data") {
    setState((prev) =>
      prev.status === "streaming"
        ? { ...prev, rows: [...prev.rows, event.data.rows] }
        : prev
    );
  } else if (event.event === "done") {
    setState((prev) =>
      prev.status === "streaming"
        ? {
            status: "done",
            spec: prev.spec,
            rows: prev.rows,
            tokenCount: event.data.token_count,
            widgetId: event.data.widget_id,
          }
        : prev
    );
  } else {
    setState((prev) => ({
      status: "error",
      errorState: event.data.state,
      reason: event.data.reason,
      spec: prev.status === "streaming" ? prev.spec : undefined,
    }));
  }
}

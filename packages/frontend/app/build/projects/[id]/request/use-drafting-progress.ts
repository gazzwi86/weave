"use client";

import { useEffect, useState } from "react";

/** Consumes the Build engine's per-section drafting stream (`stream_url`,
 * proxied through `/api/requests/{id}/stream`) so Request Studio can show
 * live section-by-section progress while a request is `drafting` --
 * `use-request-status.ts`'s poll only ever sees the terminal state, not
 * sections as they land (the UX gap this closes). `fetch` + `ReadableStream`,
 * not `EventSource`: keeps the same auth-proxy-route pattern as every other
 * backend call here (`EventSource` can't carry the session's bearer token).
 * Purely additive -- never touches the polling status/draft_content state,
 * so it can't regress the existing 2s-poll terminal detection.
 *
 * The backend's SSE grammar is plain `data: {...}\n\n` blocks with no
 * `event:` line (see `routers/requests.py::stream_request_route`) -- this
 * is a dedicated ~15-line parser rather than reusing
 * `lib/dashboard/parse-sse-events.ts`, which requires an `event:` line and
 * doesn't match this grammar.
 */
export function useDraftingProgress(streamUrl: string | null | undefined, active: boolean): string[] {
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  useEffect(() => {
    if (!active || !streamUrl) {
      return;
    }
    const url = streamUrl;
    // ponytail: no explicit reset needed here -- `submit()` already sets
    // `request` to `null` before a new request starts, which unmounts
    // `StatusCard` (and this hook with it), so a fresh mount always starts
    // from `useState`'s `[]` initial value.
    const controller = new AbortController();

    async function run(): Promise<void> {
      const res = await fetch(url, { signal: controller.signal });
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffered = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffered += decoder.decode(value, { stream: true });
        const blocks = buffered.split("\n\n");
        buffered = blocks.pop() ?? "";
        for (const block of blocks) {
          const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const event = JSON.parse(dataLine.slice("data: ".length)) as { section?: string };
          if (event.section) {
            setCompletedSections((prev) => [...prev, event.section as string]);
          }
        }
      }
    }

    // ponytail: best-effort progress display only -- the 2s poll in
    // use-request-status.ts is what actually detects completion/failure, so
    // a dropped stream just means the progress line stops updating early.
    run().catch(() => undefined);

    return () => controller.abort();
  }, [streamUrl, active]);

  return completedSections;
}

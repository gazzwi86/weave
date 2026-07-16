"use client";

import { useEffect, useState } from "react";

import { normalizeUrn } from "@/lib/build/normalize-urn";

import type { BoardResponse, TaskTreeResponse } from "./types";

export interface BoardState {
  board: BoardResponse | null;
  tree: TaskTreeResponse | null;
  loadError: boolean;
}

/** AC-1: fetches the board + task-tree once on mount. No polling/SSE
 * (ADR-023 #2) -- no AC requires live push, and filter switching is a pure
 * client-side recompute over this already-fetched payload.
 */
export function useBoard(projectIri: string): BoardState {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [tree, setTree] = useState<TaskTreeResponse | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const encoded = encodeURIComponent(normalizeUrn(projectIri));

    Promise.all([
      fetch(`/api/projects/${encoded}/board`, { signal: controller.signal, cache: "no-store" }),
      fetch(`/api/projects/${encoded}/task-tree`, {
        signal: controller.signal,
        cache: "no-store",
      }),
    ])
      .then(async ([boardRes, treeRes]) => {
        if (!boardRes.ok || !treeRes.ok) throw new Error("board_load_failed");
        setBoard((await boardRes.json()) as BoardResponse);
        setTree((await treeRes.json()) as TaskTreeResponse);
        setLoadError(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }
        console.error("Board load failed", err);
        setLoadError(true);
      });

    return () => controller.abort();
  }, [projectIri]);

  return { board, tree, loadError };
}

"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { matchesSearchQuery } from "@/lib/explorer/search-filter";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export interface SearchResult {
  id: string;
  label: string;
  typeLabel: string;
}

export interface UseSearchOverlayOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  onResultSelected: (nodeId: string) => void;
}

export interface UseSearchOverlayResult {
  open: boolean;
  query: string;
  results: SearchResult[];
  noResults: boolean;
  setQuery: (query: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  selectResult: (nodeId: string) => void;
}

function isTextInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || active.getAttribute("contenteditable") === "true";
}

function isSearchShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}

interface SearchUpdate {
  results: SearchResult[];
  noResults: boolean;
}

// XT-008: pulled out of useSearchOverlay's setQuery callback to keep the
// hook under Law E's line budget -- the matching/highlighting logic doesn't
// need hook state, just the adapter and the query.
function applySearchQuery(
  adapter: RendererAdapter | null,
  nextQuery: string,
  dimOpacity: number
): SearchUpdate {
  if (!adapter || nextQuery === "") {
    adapter?.resetOpacity();
    return { results: [], noResults: false };
  }

  const matches = adapter.listNodes().filter((node) => matchesSearchQuery(node, nextQuery));
  if (matches.length === 0) {
    // AC-7: leave canvas opacity exactly as it is -- no dim, no reset.
    return { results: [], noResults: true };
  }

  adapter.highlightNodes(
    matches.map((node) => node.id),
    dimOpacity
  );
  return {
    results: matches.map((node) => ({ id: node.id, label: node.label, typeLabel: node.bpmoKind })),
    noResults: false,
  };
}

/** AC-5/AC-6/AC-7: client-side-only search overlay (no CE call) -- matches
 * highlight, non-matches dim, selecting a result centres+hands off to the
 * node-spotlight flow via onResultSelected. */
export function useSearchOverlay({ adapter, config, onResultSelected }: UseSearchOverlayOptions): UseSearchOverlayResult {
  const [open, setOpen] = useState(false);
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [noResults, setNoResults] = useState(false);

  const closeOverlay = useCallback(() => setOpen(false), []);

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState(nextQuery);
      const update = applySearchQuery(adapter, nextQuery, config.spotlightDimOpacity);
      setResults(update.results);
      setNoResults(update.noResults);
    },
    [adapter, config.spotlightDimOpacity]
  );

  const selectResult = useCallback(
    (nodeId: string) => {
      closeOverlay();
      adapter?.centerOn(nodeId, config.centreAnimationMs);
      onResultSelected(nodeId);
    },
    [adapter, config.centreAnimationMs, closeOverlay, onResultSelected]
  );

  // AC-5: Cmd/Ctrl+K opens the overlay -- but never steals typing from a
  // focused text input, and stops the keystroke reaching the page-wide
  // command palette (see ADR-003).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (!isSearchShortcut(event) || isTextInputFocused()) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  // AC-4: Escape closes the overlay.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") closeOverlay();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay]);

  return { open, query, results, noResults, setQuery, openOverlay: () => setOpen(true), closeOverlay, selectResult };
}

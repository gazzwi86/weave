"use client";

import { useCallback, useRef, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { fetchDomainMembers as defaultFetchDomainMembers, type FetchDomainMembersResult } from "@/lib/explorer/fetch-domain-members";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export type DomainFocusState =
  | { status: "inactive" }
  | { status: "loading" }
  | { status: "focused" }
  | { status: "empty" }
  | { status: "error"; message: string };

export interface UseDomainFocusOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** Test seam -- defaults to the real CE-READ-1 proxy fetch. */
  fetchDomainMembers?: (domainIri: string, membershipPredicate: string, timeoutMs: number) => Promise<FetchDomainMembersResult>;
}

export interface UseDomainFocusResult {
  state: DomainFocusState;
  focusDomain: (domainIri: string) => void;
  retry: () => void;
  dismissError: () => void;
}

/** AC-1/AC-2/AC-9: right-click "Focus domain" -- dims the whole canvas to
 * `config.spotlightDimOpacity` and restores only the domain's member nodes
 * to full opacity. Reuses the TASK-003 `highlightNodes` adapter operation
 * (dim-all-then-restore-a-set) rather than adding a new one: an empty
 * member list is simply `highlightNodes([], dimOpacity)`, which dims
 * everything and restores nothing -- exactly AC-2's empty-state canvas. */
export function useDomainFocus({
  adapter,
  config,
  fetchDomainMembers = defaultFetchDomainMembers,
}: UseDomainFocusOptions): UseDomainFocusResult {
  const [state, setState] = useState<DomainFocusState>({ status: "inactive" });
  const requestIdRef = useRef(0);
  const lastDomainIriRef = useRef<string | null>(null);

  const focusDomain = useCallback(
    (domainIri: string) => {
      if (!adapter) return;
      lastDomainIriRef.current = domainIri;
      const requestId = ++requestIdRef.current;
      setState({ status: "loading" });

      fetchDomainMembers(domainIri, config.domainMembershipPredicate, config.ceTimeoutMs).then((result) => {
        if (requestId !== requestIdRef.current) return; // a newer focus request superseded this one

        if (result.type === "error") {
          adapter.resetOpacity();
          setState({ status: "error", message: `CE error ${result.status}` });
          return;
        }

        adapter.highlightNodes(
          result.rows.map((row) => row.entityIri),
          config.spotlightDimOpacity
        );
        setState({ status: result.rows.length === 0 ? "empty" : "focused" });
      });
    },
    [adapter, config.domainMembershipPredicate, config.ceTimeoutMs, config.spotlightDimOpacity, fetchDomainMembers]
  );

  const retry = useCallback(() => {
    if (lastDomainIriRef.current) focusDomain(lastDomainIriRef.current);
  }, [focusDomain]);

  // AC-9: dismissing the notice never touches the canvas -- opacity was
  // already restored when the error first occurred.
  const dismissError = useCallback(() => setState({ status: "inactive" }), []);

  return { state, focusDomain, retry, dismissError };
}

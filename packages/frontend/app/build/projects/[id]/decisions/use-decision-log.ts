import { useCallback, useEffect, useState } from "react";

import { normalizeUrn } from "@/lib/build/normalize-urn";

export type DecisionKind = "decision" | "task_update" | "system";
export type KindFilter = "all" | DecisionKind;

/** The panel's landing view -- kind=decision, no search text. B4: a project
 * that genuinely has no decisions yet lands here, so this is also the
 * "idle" state the empty-state copy needs to distinguish from a filtered
 * zero-match.
 */
export const DEFAULT_KIND: KindFilter = "decision";

export interface DecisionEntry {
  seq: number;
  ts: string;
  actor_principal_iri: string;
  event_type: string;
  target_iri: string;
  diff_summary: Record<string, unknown> | null;
  kind: DecisionKind;
}

interface DecisionPage {
  entries: DecisionEntry[];
  next_cursor: number | null;
}

export interface DecisionLogState {
  entries: DecisionEntry[];
  auditUnavailable: boolean;
  kind: KindFilter;
  setKind: (kind: KindFilter) => void;
  search: string;
  applySearch: (search: string) => void;
  hasMore: boolean;
  loadMore: () => void;
  highlightSeq: number | null;
}

/** Reads `?record={seq}` so a task-brief/ADR link can deep-link straight to
 * a row (AC-3). Lazy `useState` initializer rather than a mount effect --
 * `window` is undefined during SSR so this resolves to `null` there, same
 * as the client's first paint (no rows are loaded yet either way), so
 * there is no hydration mismatch to guard against.
 */
function readRecordParam(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("record");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

function buildQuery(kind: KindFilter, search: string, cursor: number | null): string {
  const query = new URLSearchParams({ kind });
  if (search) query.set("search", search);
  if (cursor !== null) query.set("cursor", String(cursor));
  return query.toString();
}

function fetchPage(
  projectId: string,
  kind: KindFilter,
  search: string,
  cursor: number | null
): Promise<DecisionPage | { auditUnavailable: true }> {
  return fetch(
    `/api/build/projects/${encodeURIComponent(normalizeUrn(projectId))}/decisions?${buildQuery(kind, search, cursor)}`
  ).then((res): DecisionPage | { auditUnavailable: true } | Promise<DecisionPage> => {
    if (res.status === 503) return { auditUnavailable: true as const };
    if (!res.ok) throw new Error("decisions_failed");
    return res.json() as Promise<DecisionPage>;
  });
}

interface ChaseQuery {
  projectId: string;
  kind: KindFilter;
  search: string;
  wantedRecord: number | null;
}

interface ChaseCallbacks {
  onUnavailable: () => void;
  onPage: (merged: DecisionEntry[], nextCursor: number | null) => void;
}

/** Fetches one page and, while a `?record` deep link is still unmatched and
 * a next page exists, recurses to fetch the next one (AC-3) -- module-level
 * (not a closure inside the effect) to keep nesting under Law E's depth
 * budget and to fetch pages sequentially with no rendering effect side
 * effects tangled into the recursion itself.
 */
function chaseDecisionPages(
  query: ChaseQuery,
  cursor: number | null,
  acc: DecisionEntry[],
  isCancelled: () => boolean,
  callbacks: ChaseCallbacks
): void {
  fetchPage(query.projectId, query.kind, query.search, cursor)
    .then((result) => {
      if (isCancelled()) return;
      if ("auditUnavailable" in result) {
        callbacks.onUnavailable();
        return;
      }
      const merged = [...acc, ...result.entries];
      callbacks.onPage(merged, result.next_cursor);
      const found = merged.some((e) => e.seq === query.wantedRecord);
      if (query.wantedRecord !== null && !found && result.next_cursor !== null) {
        chaseDecisionPages(query, result.next_cursor, merged, isCancelled, callbacks);
      }
    })
    .catch(() => {
      if (!isCancelled()) callbacks.onUnavailable();
    });
}

/** Drives the Decision Log's search/filter/pagination against `GET
 * /api/build/projects/{id}/decisions` (TASK-020). Every filter or search
 * change re-queries the server (AC-8) -- there is no client-side row
 * hiding over an already-fetched page, so the cursor pager and the active
 * filter can never disagree. When a `?record` deep link names a row past
 * the first page, the load effect auto-chases subsequent pages until it's
 * found (AC-3) -- capped by the log simply running out of pages.
 */
export function useDecisionLog(projectId: string): DecisionLogState {
  const [kind, setKind] = useState<KindFilter>(DEFAULT_KIND);
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [wantedRecord] = useState<number | null>(readRecordParam);

  useEffect(() => {
    let cancelled = false;
    chaseDecisionPages(
      { projectId, kind, search, wantedRecord },
      null,
      [],
      () => cancelled,
      {
        onUnavailable: () => setAuditUnavailable(true),
        onPage: (merged, nextCursor) => {
          setAuditUnavailable(false);
          setEntries(merged);
          setCursor(nextCursor);
        },
      }
    );
    return () => {
      cancelled = true;
    };
  }, [projectId, kind, search, wantedRecord]);

  const applySearch = useCallback((value: string) => setSearch(value), []);

  const loadMore = useCallback(() => {
    if (cursor === null) return;
    fetchPage(projectId, kind, search, cursor)
      .then((result) => {
        if ("auditUnavailable" in result) {
          setAuditUnavailable(true);
          return;
        }
        setEntries((prev) => [...prev, ...result.entries]);
        setCursor(result.next_cursor);
      })
      .catch(() => setAuditUnavailable(true));
  }, [projectId, kind, search, cursor]);

  const highlightSeq = wantedRecord !== null && entries.some((e) => e.seq === wantedRecord)
    ? wantedRecord
    : null;

  return {
    entries,
    auditUnavailable,
    kind,
    setKind,
    search,
    applySearch,
    hasMore: cursor !== null,
    loadMore,
    highlightSeq,
  };
}

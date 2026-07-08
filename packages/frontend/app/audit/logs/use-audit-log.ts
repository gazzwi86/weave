import { useCallback, useEffect, useState } from "react";

export interface AuditEntry {
  seq: number;
  ts: string;
  actor_principal_iri: string;
  engine: string;
  event_type: string;
  target_iri: string;
  diff_summary: Record<string, unknown> | null;
  hash: string;
  prev_hash: string;
  signature: string;
}

export interface AuditLogPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  per_page: number;
}

export interface VerifyResult {
  valid: boolean;
  entries_checked: number;
  first_broken_seq: number | null;
  error: string | null;
}

export const PER_PAGE = 50;

interface AuditFetchState {
  data: AuditLogPage | null;
  loadError: boolean;
  denied: boolean;
}

export interface AuditLogState extends AuditFetchState {
  page: number;
  setPage: (page: number) => void;
  eventType: string | null;
  applyEventType: (value: string) => void;
  verifyResult: VerifyResult | null;
  verifying: boolean;
  verifyChain: () => Promise<void>;
}

/** Fetches one page of the audit log whenever page/filter change -- split
 * out of `useAuditLog` to keep each hook under the function length budget
 * (same shape as billing's useUsageFetch).
 */
function useAuditFetch(page: number, eventType: string | null): AuditFetchState {
  const [data, setData] = useState<AuditLogPage | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (eventType === null) return undefined; // await URL hydration
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (eventType) {
      query.set("event_type", eventType);
    }
    fetch(`/api/audit?${query.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) {
          return null;
        }
        if (res.status === 403) {
          setDenied(true);
          return null;
        }
        if (!res.ok) {
          throw new Error("audit_failed");
        }
        return res.json() as Promise<AuditLogPage>;
      })
      .then((body) => {
        if (controller.signal.aborted || !body) {
          return;
        }
        setData(body);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(true);
      });
    return () => controller.abort();
  }, [page, eventType]);

  return { data, loadError, denied };
}

/** Reads the initial event-type filter from the URL (?event_type=...) so
 * dashboard category links land pre-filtered. Resolved in a mount effect --
 * reading window.location during render makes SSR and client HTML diverge
 * (the /ce chat hydration bug all over again). The fetch effect waits for
 * hydration, so the first fetch is still the filtered one.
 */
function readEventTypeParam(): string {
  return new URLSearchParams(window.location.search).get("event_type") ?? "";
}

/** Drives the /audit/logs viewer: paged tenant-scoped log fetch (admin-only
 * upstream -- 403 surfaces as `denied`), event-type filter (seeded from the
 * `event_type` URL param, resets to page 1 on apply), and the on-demand
 * hash-chain verification.
 */
export function useAuditLog(): AuditLogState {
  const [page, setPage] = useState(1);
  // null = not yet hydrated from the URL; gates the first fetch.
  const [eventType, setEventType] = useState<string | null>(null);

  useEffect(() => {
    // SSR hydration: window.location is browser-only, so the URL-seeded filter
    // must be read post-mount, not during render (see readEventTypeParam).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventType(readEventTypeParam());
  }, []);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { data, loadError, denied } = useAuditFetch(page, eventType);

  const applyEventType = useCallback((value: string) => {
    setEventType(value);
    setPage(1);
  }, []);

  const verifyChain = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/audit/verify", { method: "POST" });
      if (!res.ok) {
        throw new Error("verify_failed");
      }
      setVerifyResult((await res.json()) as VerifyResult);
    } catch {
      setVerifyResult(null);
    } finally {
      setVerifying(false);
    }
  }, []);

  return {
    data,
    loadError,
    denied,
    page,
    setPage,
    eventType,
    applyEventType,
    verifyResult,
    verifying,
    verifyChain,
  };
}

"use client";

import { Fragment, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { PER_PAGE, useAuditLog, type AuditEntry, type VerifyResult } from "./use-audit-log";

function downloadBlob(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function VerifyResultBadge({ result }: { result: VerifyResult }) {
  return (
    <p data-testid="verify-result">
      Chain{" "}
      {result.valid ? <Badge variant="success">valid</Badge> : <Badge variant="danger">broken</Badge>}{" "}
      — {result.entries_checked} entries checked
      {!result.valid && result.first_broken_seq !== null && (
        <>, first broken seq {result.first_broken_seq}</>
      )}
    </p>
  );
}

function FilterForm({
  initialValue,
  onApply,
}: {
  initialValue: string;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onApply(value.trim());
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-[var(--space-2)]">
      <Input
        aria-label="Event type"
        placeholder="event type"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" variant="secondary">
        Filter
      </Button>
    </form>
  );
}

function ExportButtons({ entries }: { entries: AuditEntry[] }) {
  return (
    <>
      <Button
        variant="secondary"
        onClick={() =>
          downloadBlob("audit-log.json", JSON.stringify(entries, null, 2), "application/json")
        }
      >
        Export JSON
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          downloadBlob(
            "audit-log.ndjson",
            entries.map((entry) => JSON.stringify(entry)).join("\n"),
            "application/x-ndjson"
          )
        }
      >
        Export NDJSON
      </Button>
    </>
  );
}

const CELL = "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]";
const COLUMNS = ["Seq", "Timestamp", "Actor", "Engine", "Event type", "Target"];

function LogsTable({ entries }: { entries: AuditEntry[] }) {
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {COLUMNS.map((name) => (
              <th
                key={name}
                className={`${CELL} font-[var(--font-weight-semibold)] text-[var(--color-text-default)]`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <Fragment key={entry.seq}>
              <tr
                data-testid={`log-row-${entry.seq}`}
                className="cursor-pointer text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
                onClick={() => setExpandedSeq(expandedSeq === entry.seq ? null : entry.seq)}
              >
                <td className={CELL}>{entry.seq}</td>
                <td className={CELL}>{entry.ts}</td>
                <td className={CELL}>{entry.actor_principal_iri}</td>
                <td className={CELL}>{entry.engine}</td>
                <td className={CELL}>{entry.event_type}</td>
                <td className={CELL}>{entry.target_iri}</td>
              </tr>
              {expandedSeq === entry.seq && (
                <tr data-testid={`log-detail-${entry.seq}`}>
                  <td colSpan={COLUMNS.length} className={CELL}>
                    <pre className="overflow-x-auto text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
                      {JSON.stringify(entry, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-[var(--color-text-muted)]">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

/** /audit/logs: row-level viewer over the immutable, hash-chained trail.
 * Admin-only upstream -- a 403 renders the denied copy (same style as
 * settings/workspaces). Expanding a row shows the full signed entry
 * (hash, prev_hash, signature, diff_summary); exports are client-side
 * over the currently loaded page.
 */
export default function AuditLogsPage() {
  const {
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
  } = useAuditLog();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        View logs
      </h1>

      {denied ? (
        <p data-testid="logs-denied" className="text-[var(--color-text-muted)]">
          Audit log access is available to workspace admins only.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-[var(--space-3)]">
            {eventType !== null && (
              <FilterForm initialValue={eventType} onApply={applyEventType} />
            )}
            <Button onClick={verifyChain} disabled={verifying}>
              {verifying ? "Verifying…" : "Verify chain"}
            </Button>
            {data && <ExportButtons entries={data.entries} />}
          </div>

          {verifyResult && <VerifyResultBadge result={verifyResult} />}

          {loadError && !data && (
            <p data-testid="logs-error" className="text-[var(--color-text-muted)]">
              Unable to load the audit log from the backend.
            </p>
          )}

          {data && (
            <Card>
              <CardContent className="flex flex-col gap-[var(--space-4)]">
                <LogsTable entries={data.entries} />
                <Pagination page={page} total={data.total} onPage={setPage} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}

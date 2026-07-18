"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/toast-provider";

import type { AuditEntry, VerifyResult } from "./use-audit-log";

export function downloadBlob(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Human summary of what changed, derived only from the entry's own
 * `diff_summary` field count -- no fabricated version numbers or change
 * descriptions (refit-mock.html's ".ld-grid Change" row, grounded in real
 * data only; the backend carries no version-id field to cite one). */
function changeSummary(entry: AuditEntry): string {
  if (!entry.diff_summary) return "Entry recorded and chained.";
  const n = Object.keys(entry.diff_summary).length;
  return `${n} field${n === 1 ? "" : "s"} changed.`;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-caption)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
        {label}
      </span>
      <span className="break-all font-[var(--font-mono)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
        {value}
      </span>
    </div>
  );
}

export interface RowDetailProps {
  entry: AuditEntry;
  lastVerify: VerifyResult | null;
}

/** Full signed entry, expanded: actor URN, target IRI, entry/prev hash,
 * signature (annotated with the most recent chain-verify outcome -- a
 * whole-chain check, not a per-row one, so it reads "chain verified"
 * rather than claiming this specific signature was just re-checked), and a
 * real, derived change summary. Export JSON / Copy IRI both stop
 * propagation so they don't collapse the row. */
export function RowDetail({ entry, lastVerify }: RowDetailProps) {
  const { toast } = useToast();
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-3">
        <DetailField label="Actor URN" value={entry.actor_principal_iri} />
        <DetailField label="Target IRI" value={entry.target_iri} />
        <DetailField label="Entry hash" value={entry.hash} />
        <DetailField label="Prev hash" value={entry.prev_hash} />
        <div className="flex flex-col gap-[var(--space-1)]">
          <span className="text-[length:var(--text-caption)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
            Signature
          </span>
          <span className="flex items-center gap-[var(--space-2)] break-all font-[var(--font-mono)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
            {entry.signature}
            {lastVerify && (
              <Badge variant={lastVerify.valid ? "success" : "danger"}>
                {lastVerify.valid ? "chain verified" : "chain broken"}
              </Badge>
            )}
          </span>
        </div>
        <DetailField label="Change" value={changeSummary(entry)} />
      </div>
      <div className="flex gap-[var(--space-2)]">
        <Button
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            downloadBlob(`audit-entry-${entry.seq}.json`, JSON.stringify(entry, null, 2), "application/json");
          }}
        >
          Export JSON
        </Button>
        <Button
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            navigator.clipboard.writeText(entry.target_iri);
            toast({ variant: "info", message: "IRI copied." });
          }}
        >
          Copy IRI
        </Button>
      </div>
    </div>
  );
}

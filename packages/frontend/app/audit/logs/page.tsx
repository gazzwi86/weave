"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTableSlot as DataTable, type DataTableRow } from "@/components/templates/DataTableSlot";
import { EntityRefSlot as EntityRef } from "@/components/templates/EntityRefSlot";
import { FilterFormSlot as FilterForm, type FilterFormField } from "@/components/templates/FilterFormSlot";
import { RelativeTimeSlot as RelativeTime } from "@/components/templates/RelativeTimeSlot";
import { TypeaheadFieldSlot as TypeaheadField, type TypeaheadOption } from "@/components/templates/TypeaheadFieldSlot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast/toast-provider";

import { EMPTY_FILTERS, PER_PAGE, useAuditLog, type AuditEntry, type AuditFilters, type VerifyResult } from "./use-audit-log";
import { downloadBlob, RowDetail } from "./logs-row-detail";

/** Last colon-segment of a principal URN (e.g. `abc123` from
 * `urn:weave:principal:user:abc123`) -- the only "friendly" material an
 * audit entry carries for its actor; the full URN stays available as
 * EntityRef's secondary mono id. */
function friendlyActorLabel(iri: string): string {
  return iri.split(":").at(-1) ?? iri;
}

/** Distinct actor URNs seen on the currently loaded page, as typeahead
 * options -- there is no "list all actors" endpoint (`PLAT-AUDIT-1` only
 * supports filtering, not enumeration), so the picker offers recently-seen
 * real actors rather than an invented directory. */
function actorOptions(entries: AuditEntry[]): TypeaheadOption[] {
  const seen = new Set<string>();
  const options: TypeaheadOption[] = [];
  for (const entry of entries) {
    if (seen.has(entry.actor_principal_iri)) continue;
    seen.add(entry.actor_principal_iri);
    options.push({
      value: entry.actor_principal_iri,
      label: friendlyActorLabel(entry.actor_principal_iri),
      sub: entry.actor_principal_iri,
    });
  }
  return options;
}

const ENGINE_OPTIONS = [
  { value: "", label: "All" },
  { value: "ce", label: "ce" },
  { value: "platform", label: "platform" },
  { value: "build", label: "build" },
];

interface FiltersProps {
  /** Seeds the form's own draft state once, on mount -- this component is
   * only rendered after `filters` hydrates from the URL (the `filters !==
   * null` gate below), so a fresh mount always carries the right seed. */
  initialValue: AuditFilters;
  actors: TypeaheadOption[];
  onApply: (filters: AuditFilters) => void;
  onReset: () => void;
}

interface BuildFieldsArgs {
  draft: AuditFilters;
  set: (key: keyof AuditFilters) => (value: string) => void;
  actors: TypeaheadOption[];
  actorOpen: boolean;
  setActorOpen: (open: boolean) => void;
}

/** The seven `PLAT-AUDIT-1` field definitions -- split out of `LogsFilters`
 * to keep that component under the function-length budget. */
function buildFilterFields({ draft, set, actors, actorOpen, setActorOpen }: BuildFieldsArgs): FilterFormField[] {
  return [
    { id: "engine", label: "Engine", type: "select", value: draft.engine, onChange: set("engine"), options: ENGINE_OPTIONS },
    {
      id: "event_type",
      label: "Event type",
      type: "text",
      value: draft.event_type,
      onChange: set("event_type"),
      placeholder: "ce.* or exact",
    },
    {
      id: "actor",
      label: "Actor",
      type: "text",
      value: draft.actor_principal_iri,
      onChange: set("actor_principal_iri"),
      render: () => (
        <TypeaheadField
          id="ff-field-actor"
          label="Actor"
          value={draft.actor_principal_iri}
          onValueChange={set("actor_principal_iri")}
          options={actors}
          open={actorOpen}
          onOpenChange={setActorOpen}
          onPick={(option) => set("actor_principal_iri")(option.value)}
        />
      ),
    },
    {
      id: "target",
      label: "Target",
      type: "text",
      value: draft.target_iri,
      onChange: set("target_iri"),
      placeholder: "Entity name or IRI",
    },
    { id: "date_from", label: "From", type: "date", value: draft.date_from, onChange: set("date_from") },
    { id: "date_to", label: "To", type: "date", value: draft.date_to, onChange: set("date_to") },
    { id: "q", label: "Search", type: "text", value: draft.q, onChange: set("q"), grow: true },
  ];
}

/** The full seven-dimension `PLAT-AUDIT-1` filter form (AC-5): engine,
 * event_type, actor (typeahead), target, date_from/date_to, and free-text
 * q -- Reset/Apply bottom-aligned via `FilterForm`'s own layout. */
function LogsFilters({ initialValue, actors, onApply, onReset }: FiltersProps) {
  const [draft, setDraft] = useState(initialValue);
  const [actorOpen, setActorOpen] = useState(false);
  const set = (key: keyof AuditFilters) => (value: string) => setDraft({ ...draft, [key]: value });
  const fields = buildFilterFields({ draft, set, actors, actorOpen, setActorOpen });

  return (
    <FilterForm
      fields={fields}
      onApply={() => onApply(draft)}
      onReset={() => {
        setDraft(EMPTY_FILTERS);
        onReset();
      }}
    />
  );
}

const COLUMNS = [
  { key: "when", label: "When" },
  { key: "event", label: "Event" },
  { key: "actor", label: "Actor" },
  { key: "target", label: "Target" },
];

function entryToRow(entry: AuditEntry): DataTableRow {
  return {
    id: String(entry.seq),
    cells: {
      when: <RelativeTime iso={entry.ts} />,
      event: (
        <span className="flex items-center gap-[var(--space-2)]">
          <Badge variant="info">{entry.engine}</Badge>
          {entry.event_type}
        </span>
      ),
      actor: <EntityRef label={friendlyActorLabel(entry.actor_principal_iri)} id={entry.actor_principal_iri} />,
      target: entry.target_iri,
    },
  };
}

function paginationProps(page: number, total: number, onPage: (page: number) => void) {
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  return { page, pageCount, rangeLabel: `Showing ${from}–${to} of ${total}`, onPageChange: onPage };
}

/** Toasts the real `POST /api/audit/verify` outcome once per verify call --
 * never a fabricated entry count. Fires only when `verifyResult` changes
 * (a fresh object per call), so mount with a null result is silent. */
function useVerifyResultToast(verifyResult: VerifyResult | null): void {
  const { toast } = useToast();
  useEffect(() => {
    if (!verifyResult) return;
    toast({
      variant: verifyResult.valid ? "success" : "error",
      message: verifyResult.valid
        ? `Chain valid — ${verifyResult.entries_checked} entries checked.`
        : `Chain broken at seq ${verifyResult.first_broken_seq} — ${verifyResult.entries_checked} entries checked.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyResult]);
}

/** /audit/logs: row-level viewer over the immutable, hash-chained trail.
 * Admin-only upstream -- a 403 renders the denied copy (same style as
 * settings/workspaces). Sheds the page's former hand-rolled table/filter
 * bar for the shared `DataTable`/`FilterForm`/`TypeaheadField` organisms;
 * this file is now presentational glue over `use-audit-log`.
 */
interface LogsHeaderProps {
  data: ReturnType<typeof useAuditLog>["data"];
  verifyChain: () => Promise<void>;
}

/** Title plus the header Export / Verify-chain actions -- hidden while
 * denied or before the first page loads. */
function LogsHeader({ data, verifyChain }: LogsHeaderProps) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between gap-[var(--space-4)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        View logs
      </h1>
      {data && (
        <div className="flex gap-[var(--space-2)]">
          <Button
            variant="ghost"
            onClick={() => downloadBlob("audit-log.json", JSON.stringify(data.entries, null, 2), "application/json")}
          >
            Export
          </Button>
          <Button
            onClick={() => {
              toast({ variant: "info", message: `Verifying ${data.total} entries…` });
              verifyChain();
            }}
          >
            Verify chain
          </Button>
        </div>
      )}
    </div>
  );
}

interface LogsTableProps {
  data: NonNullable<ReturnType<typeof useAuditLog>["data"]>;
  page: number;
  setPage: (page: number) => void;
  verifyResult: ReturnType<typeof useAuditLog>["verifyResult"];
}

/** The `DataTable` card: rows, expandable signed-entry detail, pagination. */
function LogsTable({ data, page, setPage, verifyResult }: LogsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const rows = useMemo(() => data.entries.map(entryToRow), [data]);
  const entryBySeq = useMemo(() => new Map(data.entries.map((entry) => [String(entry.seq), entry])), [data]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-0 p-0">
        <DataTable
          columns={COLUMNS}
          rows={rows}
          expandable={{
            expandedRowId,
            onToggleRow: (id) => setExpandedRowId(expandedRowId === id ? null : id),
            renderDetail: (row) => {
              const entry = entryBySeq.get(row.id);
              return entry ? <RowDetail entry={entry} lastVerify={verifyResult} /> : null;
            },
          }}
          pagination={paginationProps(page, data.total, setPage)}
        />
      </CardContent>
    </Card>
  );
}

export default function AuditLogsPage() {
  const { data, loadError, denied, page, setPage, filters, applyFilters, verifyResult, verifyChain } =
    useAuditLog();

  useVerifyResultToast(verifyResult);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <LogsHeader data={!denied ? data : null} verifyChain={verifyChain} />

      {denied ? (
        <p data-testid="logs-denied" className="text-[var(--color-text-muted)]">
          Audit log access is available to workspace admins only.
        </p>
      ) : (
        <>
          {filters !== null && (
            <LogsFilters
              initialValue={filters}
              actors={actorOptions(data?.entries ?? [])}
              onApply={applyFilters}
              onReset={() => applyFilters(EMPTY_FILTERS)}
            />
          )}

          {loadError && !data && (
            <p data-testid="logs-error" className="text-[var(--color-text-muted)]">
              Unable to load the audit log from the backend.
            </p>
          )}

          {data && <LogsTable data={data} page={page} setPage={setPage} verifyResult={verifyResult} />}
        </>
      )}
    </main>
  );
}

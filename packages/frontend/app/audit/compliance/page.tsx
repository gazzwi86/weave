"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ExplainBand } from "@/components/ui/explain-band";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast/toast-provider";

import { downloadBlob } from "../logs/logs-row-detail";
import { useCompliance, type ComplianceSummary } from "./use-compliance";

/** refit-mock.html `.chain-explainer` -- the page's one-line verdict. Scoped
 * strictly to what the chain-verify endpoint actually measures: chain
 * integrity + entries checked. It never claims "no policy violations" or
 * "full coverage" -- this backend carries no data to back either claim
 * (see the pending stat cards below). */
function Verdict({ summary }: { summary: ComplianceSummary }) {
  const valid = summary.chain_status === "valid";
  const body = valid ? (
    <>
      <b className="text-[var(--color-text-default)]">Chain verifies end-to-end.</b>{" "}
      {summary.entries_checked.toLocaleString()} entries checked, no gaps in the hash chain.
    </>
  ) : (
    <>
      <b className="text-[var(--color-text-default)]">Chain broken at entry {summary.first_broken_seq}.</b>{" "}
      {summary.entries_checked.toLocaleString()} entries checked before the break was found.
    </>
  );
  return (
    <div data-testid="compliance-verdict">
      <ExplainBand tone={valid ? "success" : "danger"} icon={valid ? "check" : "alert-triangle"} body={body} />
    </div>
  );
}

/** refit-mock.html `.kpi-row` of `.stat-card`s. Chain status is real data;
 * policy-violations and coverage-gaps have no backing endpoint on any
 * branch (no gap ticket exists for either yet); audit_outages is `G8`
 * (`feat/audit-aggregation-gaps`, PR #135, unmerged in this worktree) --
 * `undefined` means "not served yet", never "zero". */
function StatCardsRow({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
      <div data-testid="stat-chain">
        <StatCard
          value={summary.chain_status === "valid" ? "Valid" : "Broken"}
          label={`chain — ${summary.entries_checked.toLocaleString()} entries verified`}
          tone={summary.chain_status === "valid" ? "ok" : "bad"}
        />
      </div>
      <div data-testid="stat-policy-violations">
        <StatCard value="—" label="policy violations — not available yet" tone="neutral" />
      </div>
      <div data-testid="stat-coverage-gaps">
        <StatCard value="—" label="coverage gaps — not available yet" tone="neutral" />
      </div>
      <div data-testid="stat-audit-outages">
        {summary.audit_outages !== undefined ? (
          <StatCard
            value={String(summary.audit_outages)}
            label="audit outages — 30 days"
            tone={summary.audit_outages > 0 ? "bad" : "ok"}
          />
        ) : (
          <StatCard value="—" label="audit outages — not available yet" tone="neutral" />
        )}
      </div>
    </div>
  );
}

interface AttentionRow {
  key: string;
  dotTone: "danger" | "warn";
  bold: string;
  href?: string;
}

const DOT_COLOUR: Record<AttentionRow["dotTone"], string> = {
  danger: "var(--color-danger)",
  warn: "var(--color-warn)",
};

/** Only real, measured signals -- no illustrative rows invented from data
 * this backend doesn't carry (refit-mock.html's example rows name process
 * owners and per-kind rule coverage, neither of which has a source here). */
function attentionRows(summary: ComplianceSummary): AttentionRow[] {
  const rows: AttentionRow[] = [];
  if (summary.chain_status === "broken") {
    rows.push({
      key: "chain-broken",
      dotTone: "danger",
      bold: `Chain broken at entry ${summary.first_broken_seq}`,
      href: "/audit/logs",
    });
  }
  if (summary.audit_outages !== undefined && summary.audit_outages > 0) {
    rows.push({
      key: "audit-outages",
      dotTone: "warn",
      bold: `${summary.audit_outages} audit outage${summary.audit_outages === 1 ? "" : "s"} in the last 30 days`,
      href: "/audit/logs",
    });
  }
  return rows;
}

function AttentionList({ summary }: { summary: ComplianceSummary }) {
  const rows = attentionRows(summary);
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">What needs attention</p>
        {rows.length === 0 ? (
          <p data-testid="attention-empty" className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
            Nothing outstanding from the signals this page can measure. Policy-violation and
            coverage-gap detection aren&apos;t served by this backend yet.
          </p>
        ) : (
          <ul data-testid="attention-list" className="flex flex-col gap-[var(--space-2)]">
            {rows.map((row) => (
              <li key={row.key} className="flex items-start gap-[var(--space-2)]">
                <span
                  className="mt-[var(--space-1)] h-[var(--space-2)] w-[var(--space-2)] shrink-0 rounded-[var(--radius-full)]"
                  style={{ background: DOT_COLOUR[row.dotTone] }}
                />
                {row.href ? (
                  <a href={row.href} className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
                    <b className="text-[var(--color-text-default)]">{row.bold}</b>
                  </a>
                ) : (
                  <span className="text-[length:var(--text-body-sm)]">
                    <b className="text-[var(--color-text-default)]">{row.bold}</b>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Downloads the current summary as an evidence JSON file and confirms via
 * toast -- same `downloadBlob` helper the logs page's Export button uses. */
function EvidenceExportButton({ summary }: { summary: ComplianceSummary }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        downloadBlob(
          `audit-compliance-evidence-${summary.period}.json`,
          JSON.stringify(summary, null, 2),
          "application/json"
        );
        toast({ variant: "success", message: "Evidence exported." });
      }}
      className="rounded-[var(--radius-base)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
    >
      Export evidence
    </button>
  );
}

function ComplianceBody({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <Verdict summary={summary} />
      <StatCardsRow summary={summary} />
      <AttentionList summary={summary} />
    </div>
  );
}

/** /audit/compliance (refit-mock.html `#sub-aud-compliance`): "is our record
 * trustworthy, are our rules being kept, and where are the gaps?" -- a
 * verdict band plus stat cards scoped to what `GET /api/audit/compliance`
 * actually measures. Policy-violations and coverage-gaps have no backing
 * endpoint on any branch; audit_outages lights up once `feat/audit-
 * aggregation-gaps` (PR #135, G8) merges -- all three degrade to an honest
 * pending state here rather than fabricated figures.
 */
export default function CompliancePage() {
  const { summary, loadError } = useCompliance();

  return (
    <main data-tour-id="compliance.page" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div>
          <p className="text-[length:var(--text-overline)] font-[var(--font-weight-semibold)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-accent-primary)]">
            Audit trail
          </p>
          <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Compliance
          </h1>
          <p className="mt-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Is our record trustworthy, are our rules being kept, and where are the gaps?
          </p>
        </div>
        {summary && <EvidenceExportButton summary={summary} />}
      </div>

      {loadError && !summary && (
        <p data-testid="compliance-error" className="text-[var(--color-text-muted)]">
          Unable to load the compliance summary from the backend.
        </p>
      )}

      {summary && <ComplianceBody summary={summary} />}
    </main>
  );
}

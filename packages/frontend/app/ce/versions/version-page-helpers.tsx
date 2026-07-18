import type { TimelineEntry } from "@/components/templates/VersionsTimelineDrawer";

import type { RulesState } from "../rules/use-rules";
import type { DiffResult, VersionEntry } from "./types";

/** The single active draft this UI publishes -- the mock only ever shows
 * one in-flight draft, so the first one found wins if a workspace somehow
 * has more than one. */
export function selectDraft(versions: VersionEntry[]): VersionEntry | undefined {
  return versions.find((entry) => entry.status === "draft");
}

function versionTimestamp(entry: VersionEntry): number {
  return new Date(entry.published_at ?? entry.created_at).getTime();
}

/** Published-only entries, newest first -- drafts get the ExplainBand, not
 * a timeline row (refit-mock.html `#sub-versions`'s timeline is a published
 * history; the latest published entry carries the accent glow). */
export function publishedEntriesDesc(versions: VersionEntry[]): VersionEntry[] {
  return versions.filter((entry) => entry.status === "published").sort((a, b) => versionTimestamp(b) - versionTimestamp(a));
}

interface DraftDiffState {
  loading: boolean;
  notFound: boolean;
  diff: DiffResult | null;
}

/** refit-mock.html `#sub-versions`'s draft-card copy, parametrized with
 * real CE-DIFF-1 data (the draft-vs-latest-published triple count) rather
 * than a fabricated number or a gap note -- more honest than either brief
 * option since the diff endpoint already gives a real count for free. */
export function buildDraftBandBody(draft: VersionEntry, latestPublished: VersionEntry | null, diff: DraftDiffState): string {
  if (diff.loading) return "Draft — checking changes…";
  if (diff.notFound || !latestPublished) {
    return `Draft — first version. Publishing creates v${draft.semver}.`;
  }
  const count = diff.diff ? diff.diff.added.length + diff.diff.removed.length + diff.diff.modified.length : 0;
  const plural = count === 1 ? "" : "s";
  return (
    `Draft — ${count} change${plural} since v${latestPublished.semver} by ${draft.actor_iri}. ` +
    `Publishing freezes them into v${draft.semver} and notifies the team.`
  );
}

const HISTORICAL_DIFF_GAP_NOTE =
  "Diffing older published versions against each other isn't wired yet — only the current draft's diff " +
  'against the latest published version is available (see "Review & publish").';

function formatTimestamp(iso: string): string {
  // ponytail: deterministic slice instead of toLocaleString() -- avoids
  // timezone-dependent test flakiness for a "2026-07-17 09:12" display string.
  return iso.slice(0, 16).replace("T", " ");
}

export interface TimelineRowOptions {
  expandedId: string | null;
  onToggleDiff: (versionIri: string) => void;
  onViewOnCanvas: () => void;
}

/** Maps published versions onto `Timeline` entries. "Diff" toggles a gap
 * note (pairwise historical diffing has no confirmed backend semantics);
 * "View on canvas" is gap-toasted (no Explore deep-link yet). No fabricated
 * per-version change summary exists in `VersionEntry`, so the description
 * is an honest placeholder rather than an invented count. */
export function buildPublishedTimelineEntries(published: VersionEntry[], opts: TimelineRowOptions): TimelineEntry[] {
  return published.map((entry, index) => ({
    id: entry.version_iri,
    version: `v${entry.semver}`,
    timestamp: formatTimestamp(entry.published_at ?? entry.created_at),
    author: entry.actor_iri,
    description: "No change summary captured for this version.",
    latest: index === 0,
    actions: [
      { label: "Diff", onClick: () => opts.onToggleDiff(entry.version_iri) },
      { label: "View on canvas", onClick: opts.onViewOnCanvas },
    ],
    expandedContent: opts.expandedId === entry.version_iri ? <p>{HISTORICAL_DIFF_GAP_NOTE}</p> : undefined,
  }));
}

export type PreflightStatus = "pass" | "warn" | "gap";

export interface PreflightRow {
  label: string;
  status: PreflightStatus;
  detail: string;
}

const NOT_WIRED_DETAIL = "Not wired to a backend endpoint in M1.";

/** The drawer's "Pre-publish checks" rows -- Rules is real (CE-TASK-006's
 * SHACL report via `useRules`); Consistency/Provenance have no backing
 * endpoint anywhere in the codebase, so they stay honest gap rows rather
 * than fabricated green checkmarks. */
export function buildPreflightRows(rules: RulesState): PreflightRow[] {
  const rulesRow = rulesPreflightRow(rules);
  return [
    rulesRow,
    { label: "Consistency", status: "gap", detail: NOT_WIRED_DETAIL },
    { label: "Provenance", status: "gap", detail: NOT_WIRED_DETAIL },
  ];
}

function rulesPreflightRow(rules: RulesState): PreflightRow {
  if (rules.loading) return { label: "Rules", status: "gap", detail: "Running…" };
  if (rules.error || !rules.report) return { label: "Rules", status: "warn", detail: "Could not load the rule report." };
  if (rules.report.pending) return { label: "Rules", status: "gap", detail: "Not run yet." };
  const violations = rules.report.results.filter((result) => result.severity === "Violation").length;
  return {
    label: "Rules",
    status: violations === 0 ? "pass" : "warn",
    detail: `${violations} violation${violations === 1 ? "" : "s"}`,
  };
}

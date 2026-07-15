import type { VersionEntry } from "@/lib/explorer/versions/types";

import type { UseVersionsPanelResult } from "./use-versions-panel";

const HEADING_CLASS = "text-[length:var(--text-caption)] text-[var(--color-text-subtle)]";
const BANNER_CLASS =
  "mt-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]";

function VersionRow({
  version,
  isPinned,
  isCompareSelected,
  onSelect,
  onCompareSelect,
}: {
  version: VersionEntry;
  isPinned: boolean;
  isCompareSelected: boolean;
  onSelect: () => void;
  onCompareSelect: () => void;
}) {
  const label = `${version.semver}${version.is_latest ? " (latest)" : ""}`;
  return (
    <li className="flex items-center justify-between gap-[var(--space-2)]">
      <button
        type="button"
        aria-pressed={isPinned}
        aria-label={`Load version ${label} read-only`}
        onClick={onSelect}
        className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[length:var(--text-body-sm)]"
      >
        {label}
      </button>
      <button
        type="button"
        aria-pressed={isCompareSelected}
        aria-label={`Select ${label} for comparison`}
        onClick={onCompareSelect}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]"
      >
        Compare
      </button>
    </li>
  );
}

/** TASK-022: presentation-only version list + compare/export/return-to-draft
 * controls -- all state and CE-VERSION-1/CE-DIFF-1 wiring lives in
 * useVersionsPanel (same split as FilterPanel/OverlayPanel). */
export function VersionsPanel(props: UseVersionsPanelResult) {
  const { versions, listError, readOnly, pinnedIri, loadError, compareFrom, compareTo, diffNote, diffError } = props;

  return (
    <div data-testid="explorer-versions-panel" data-tour-id="ge.versions.panel">
      <h3 className={HEADING_CLASS}>Versions</h3>

      {listError && <p className={BANNER_CLASS}>Unable to load versions.</p>}
      {loadError && <p className={BANNER_CLASS}>{loadError}</p>}
      {diffError && <p className={BANNER_CLASS}>Unable to load the diff. Try again.</p>}
      {diffNote && <p className={BANNER_CLASS}>{diffNote}</p>}

      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {versions.map((version) => (
          <VersionRow
            key={version.version_iri}
            version={version}
            isPinned={pinnedIri === version.version_iri}
            isCompareSelected={compareFrom === version.version_iri || compareTo === version.version_iri}
            onSelect={() => props.selectVersion(version.version_iri)}
            onCompareSelect={() => props.selectForCompare(version.version_iri)}
          />
        ))}
      </ul>

      {compareFrom && compareTo && (
        <button
          type="button"
          onClick={props.exportDiff}
          className="mt-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]"
        >
          Export diff (JSON)
        </button>
      )}

      {readOnly && (
        <button
          type="button"
          onClick={props.returnToDraft}
          className="mt-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]"
        >
          Return to draft
        </button>
      )}
    </div>
  );
}

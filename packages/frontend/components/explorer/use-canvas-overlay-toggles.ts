"use client";

import { useCallback, useState } from "react";

import type { UseCompletenessOverlayResult } from "./use-completeness-overlay";
import type { OverlayToggle } from "./use-overlay-controls";
import type { UseVersionsPanelResult } from "./use-versions-panel";
import type { VersionEntry } from "@/lib/explorer/versions/types";

export interface UseCanvasOverlayTogglesOptions {
  completenessOverlay: UseCompletenessOverlayResult;
  versionsPanel: UseVersionsPanelResult;
}

export interface UseCanvasOverlayTogglesResult {
  toggles: OverlayToggle[];
  onToggleOverlay: (id: string) => void;
  /** Fed straight into useNodeSpotlight's impactEnabled option -- default
   * true means the existing always-on dim-on-tap (AC-1) is unaffected until
   * a caller actually flips this toggle. */
  impactEnabled: boolean;
}

// refit deferred item 1 "Change heatmap": no per-entity change-frequency
// data source exists yet -- CE-METRICS-1 is aggregate-only and the audit
// log's target_iri linkage is tenant-admin-gated, so neither backs a
// viewer-facing overlay. Pending + gap-tracked rather than faking a colour
// from something else (docs/design/remediation-2-api-gaps.md gap G17).
const CHANGE_HEATMAP_TOGGLE: OverlayToggle = {
  id: "change-heatmap",
  label: "Change heatmap (pending)",
  active: false,
  disabled: true,
  disabledReason: "No per-entity change-frequency data source yet -- see gap G17.",
};

function latestTwoVersions(versions: VersionEntry[]): [VersionEntry, VersionEntry] | [] {
  // Only published versions have a diff position -- unpublished drafts carry a
  // null `published_at` (they now arrive in the list) and would crash the
  // comparator, so exclude them before sorting rather than null-coercing them
  // into a bogus diff endpoint.
  const sorted = versions
    .filter((v): v is VersionEntry & { published_at: string } => v.published_at != null)
    .sort((a, b) => a.published_at.localeCompare(b.published_at));
  return sorted.length < 2 ? [] : (sorted.slice(-2) as [VersionEntry, VersionEntry]);
}

function versionDiffToggle(versionsPanel: UseVersionsPanelResult): OverlayToggle {
  const [from, to] = latestTwoVersions(versionsPanel.versions);
  return {
    id: "version-diff",
    label: from && to ? `Version diff: ${from.semver} → ${to.semver}` : "Version diff",
    active: Boolean(versionsPanel.compareFrom && versionsPanel.compareTo),
    disabled: !from || !to,
  };
}

/** refit deferred item 1: the Overlays-tab toggles the mock adds beyond the
 * existing colour overlays (use-overlay-controls.ts) -- Coverage gaps
 * (TASK-027, unchanged, just relocated here), Impact of selection (opacity,
 * additive to useNodeSpotlight's own always-on dim -- never gates AC-1),
 * Version diff (thin wrapper over useVersionsPanel's existing compare flow,
 * latest two published versions), and Change heatmap (pending, gap G17). */
export function useCanvasOverlayToggles({
  completenessOverlay,
  versionsPanel,
}: UseCanvasOverlayTogglesOptions): UseCanvasOverlayTogglesResult {
  const [impactEnabled, setImpactEnabled] = useState(true);

  const toggleVersionDiff = useCallback(() => {
    if (versionsPanel.compareFrom && versionsPanel.compareTo) {
      versionsPanel.clearCompare();
      return;
    }
    const [from, to] = latestTwoVersions(versionsPanel.versions);
    if (!from || !to) return;
    versionsPanel.selectForCompare(from.version_iri);
    versionsPanel.selectForCompare(to.version_iri);
  }, [versionsPanel]);

  const onToggleOverlay = useCallback(
    (id: string) => {
      if (id === "completeness") completenessOverlay.toggle();
      else if (id === "impact") setImpactEnabled((prev) => !prev);
      else if (id === "version-diff") toggleVersionDiff();
    },
    [completenessOverlay, toggleVersionDiff]
  );

  const toggles: OverlayToggle[] = [
    { id: "completeness", label: "Coverage gaps", active: completenessOverlay.active, disabled: false },
    { id: "impact", label: "Impact of selection", active: impactEnabled, disabled: false },
    versionDiffToggle(versionsPanel),
    CHANGE_HEATMAP_TOGGLE,
  ];

  return { toggles, onToggleOverlay, impactEnabled };
}

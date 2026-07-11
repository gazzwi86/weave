import { readFileSync } from "node:fs";
import type { Anchor } from "../anchors";

const DATA_TOUR_ID_RE = /data-tour-id=["']([^"']+)["']/g;

/** Dependency-free extraction of every `data-tour-id="..."` value in a source string. */
export function extractDataTourIds(source: string): string[] {
  return [...source.matchAll(DATA_TOUR_ID_RE)].map((m) => m[1]!);
}

export function extractDataTourIdsFromFiles(paths: string[]): Set<string> {
  const ids = new Set<string>();
  for (const path of paths) {
    for (const id of extractDataTourIds(readFileSync(path, "utf-8"))) ids.add(id);
  }
  return ids;
}

export type AuditResult = {
  ok: boolean;
  /** data-tour-id present in code but not (or no longer) a registry key -- always fails. */
  unregistered: string[];
  /** `shipped: true` registry entries whose attribute is missing from code -- drift (ADR-008). */
  missingShipped: string[];
};

/**
 * Two-way `data-tour-id` <-> registry audit (ADR-005, keyed on `shipped` per
 * ADR-008). At TASK-003 every anchor is `shipped: false` and no frontend code
 * plants an attribute yet, so `missingShipped` is empty by construction; the
 * check still runs so it starts failing the moment a later task's PR drifts.
 */
export function auditAnchors(registry: Record<string, Anchor>, codeIds: Set<string>): AuditResult {
  const registryIds = new Set(Object.keys(registry));
  const unregistered = [...codeIds].filter((id) => !registryIds.has(id));
  const missingShipped = Object.entries(registry)
    .filter(([, anchor]) => anchor.shipped)
    .map(([id]) => id)
    .filter((id) => !codeIds.has(id));

  return { ok: unregistered.length === 0 && missingShipped.length === 0, unregistered, missingShipped };
}

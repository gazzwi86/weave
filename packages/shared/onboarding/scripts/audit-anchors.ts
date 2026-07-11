#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANCHORS } from "../anchors";
import { auditAnchors, extractDataTourIdsFromFiles } from "../checks/audit";
import { runAllContentChecks } from "../checks/run-all";

/** Dependency-free recursive `.ts`/`.tsx` file walker (skips node_modules/.next/dist). */
function walk(dir: string, out: string[] = []): string[] {
  const SKIP = new Set(["node_modules", ".next", "dist", ".git"]);
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function main(): void {
  const frontendDir = process.argv[2] ?? join(import.meta.dirname, "../../../frontend");
  const files = walk(frontendDir);
  const codeIds = extractDataTourIdsFromFiles(files);
  const audit = auditAnchors(ANCHORS, codeIds);
  const contentErrors = runAllContentChecks();

  if (audit.unregistered.length > 0) {
    console.error("Unregistered data-tour-id attributes:", audit.unregistered);
  }
  if (audit.missingShipped.length > 0) {
    console.error("Shipped anchors missing their data-tour-id attribute:", audit.missingShipped);
  }
  for (const err of contentErrors) console.error(err);

  if (!audit.ok || contentErrors.length > 0) {
    process.exit(1);
  }
  console.warn(`Anchor + content audit passed (${files.length} frontend files scanned).`);
}

main();

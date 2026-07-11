import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// AC-9: a raw `urn:weave:principal:*` string or ISO-8601 timestamp must
// never render as primary text in the shell -- both go through
// `EntityRef`/`RelativeTime` instead. This is a static source scan (same
// pattern as `design-system-manifest.test.ts`), not a full render: it
// catches a regression the moment someone writes `{principal.iri}` again,
// without needing a live fixture per shell surface.
const SCAN_ROOTS = ["components/shell", "components/organisms", "app/dashboard", "app/help", "app/notifications"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_SUFFIXES = [".test.ts", ".test.tsx", ".stories.tsx"];

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    if (SKIP_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) return [];
    return [full];
  });
}

// A raw principal string interpolated directly into JSX text, e.g.
// `{principal.iri}` or `{foo.principal_iri}` used bare (not passed as an
// `id`/label prop into EntityRef, which is the allowed path).
const RAW_PRINCIPAL_JSX = />\s*\{[\w.]*principal_iri\}\s*</;
// A raw ISO field rendered as bare JSX text (never through RelativeTime).
const RAW_ISO_JSX = />\s*\{[\w.]*(created_at|createdAt)\}\s*</;

describe("test_no_raw_principal_or_iso_timestamp_in_shell", () => {
  const files = SCAN_ROOTS.flatMap((root) => listSourceFiles(path.join(process.cwd(), root)));

  it.each(files)("%s has no raw principal URN or ISO timestamp as bare JSX text", (file) => {
    const source = readFileSync(file, "utf-8");
    expect(RAW_PRINCIPAL_JSX.test(source)).toBe(false);
    expect(RAW_ISO_JSX.test(source)).toBe(false);
  });
});

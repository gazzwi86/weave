import { describe, expect, it } from "vitest";

import { buildDiffExport } from "../build-diff-export";
import type { DiffResponse } from "../types";

describe("buildDiffExport", () => {
  // AC-6: export JSON is the CE-DIFF-1 response plus a {from, to,
  // generated_at} envelope -- no PDF/CSV shape, ever.
  it("should produce export JSON with from/to/generated_at envelope and raw diff body", () => {
    const diff: DiffResponse = {
      added: [{ subject: "n1", predicate: "p", object: "o" }],
      removed: [],
      modified: [],
    };

    const result = buildDiffExport("v1.0.0", "v1.1.0", diff, () => "2026-07-12T00:00:00.000Z");

    expect(result).toEqual({
      from: "v1.0.0",
      to: "v1.1.0",
      generated_at: "2026-07-12T00:00:00.000Z",
      added: [{ subject: "n1", predicate: "p", object: "o" }],
      removed: [],
      modified: [],
    });
  });
});

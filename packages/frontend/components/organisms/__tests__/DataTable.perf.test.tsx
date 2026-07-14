import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableRow } from "../DataTable";

const COLUMNS = [{ key: "label", label: "Label" }];

function buildRows(count: number): DataTableRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: `urn:row-${i}`, cells: { label: `Row ${i}` } }));
}

describe("DataTable performance (TASK-031 AC-10)", () => {
  it("test_table_render_p95_500ms_at_500_rows", () => {
    const rows = buildRows(500);
    const start = performance.now();
    render(<DataTable columns={COLUMNS} rows={rows} />);
    const elapsed = performance.now() - start;

    // AC-10: client-side render budget once CE-READ-1's response has
    // arrived (excludes network/query time -- SPIKE-CE-PERF-1 default).
    expect(elapsed).toBeLessThan(500);
  });
});

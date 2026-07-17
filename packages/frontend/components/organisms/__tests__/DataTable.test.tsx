import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, DataTableNameCell, type DataTableColumn, type DataTableRow } from "../DataTable";

const COLUMNS: DataTableColumn[] = [{ key: "name", label: "Name" }];

function rowsWith(cells: DataTableRow["cells"]): DataTableRow[] {
  return [{ id: "urn:row-1", cells }];
}

describe("DataTable refit (TASK C2b-1)", () => {
  it("test_name_cell_stacks_label_over_mono_id", () => {
    render(
      <DataTable columns={COLUMNS} rows={rowsWith({ name: <DataTableNameCell label="Priya Shah" id="urn:weave:actor:priya" /> })} />
    );
    expect(screen.getByText("Priya Shah")).toBeInTheDocument();
    expect(screen.getByText("urn:weave:actor:priya")).toBeInTheDocument();
  });

  it("test_row_actions_column_renders_per_row_actions", () => {
    const onEdit = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={rowsWith({ name: "Row" })}
        renderRowActions={(row) => <button onClick={() => onEdit(row.id)}>Edit</button>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith("urn:row-1");
  });
});

describe("DataTable refit -- expandable rows", () => {
  it("test_expandable_row_toggles_detail_on_click", () => {
    const onToggleRow = vi.fn();
    const rows = rowsWith({ name: "Row" });
    render(
      <DataTable
        columns={COLUMNS}
        rows={rows}
        expandable={{
          expandedRowId: null,
          onToggleRow,
          renderDetail: () => <span>Detail content</span>,
        }}
      />
    );
    expect(screen.queryByText("Detail content")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Row"));
    expect(onToggleRow).toHaveBeenCalledWith("urn:row-1");
  });

  it("test_expandable_row_shows_detail_when_expanded", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={rowsWith({ name: "Row" })}
        expandable={{
          expandedRowId: "urn:row-1",
          onToggleRow: vi.fn(),
          renderDetail: () => <span>Detail content</span>,
        }}
      />
    );
    expect(screen.getByText("Detail content")).toBeInTheDocument();
  });
});

describe("DataTable refit -- pagination footer", () => {
  it("test_pagination_footer_renders_and_wires_onPageChange", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={rowsWith({ name: "Row" })}
        pagination={{ page: 1, pageCount: 3, rangeLabel: "Showing 1-1 of 3", onPageChange }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

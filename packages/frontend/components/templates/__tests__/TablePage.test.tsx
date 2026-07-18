import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TablePage } from "../TablePage";

const COLUMNS = [{ key: "name", label: "Name" }];
const ROWS = [{ id: "row-1", cells: { name: "Hammerbarn" } }];

describe("TablePage", () => {
  it("passes renderRowActions through to the underlying DataTable", () => {
    render(
      <TablePage
        title="Companies"
        columns={COLUMNS}
        rows={ROWS}
        renderRowActions={(row) => <button>Open {row.id}</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Open row-1" })).toBeInTheDocument();
  });

  it("renders a banner node between the header and the table", () => {
    render(
      <TablePage
        title="Companies"
        columns={COLUMNS}
        rows={ROWS}
        banner={<div data-testid="banner">Isolation notice</div>}
      />
    );
    const banner = screen.getByTestId("banner");
    const heading = screen.getByRole("heading", { name: "Companies" });
    const table = screen.getByRole("table");
    // heading before banner before table -- DOCUMENT_POSITION_FOLLOWING (4) means "comes after".
    expect(heading.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

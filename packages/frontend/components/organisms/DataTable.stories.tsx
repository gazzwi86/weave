import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTable, DataTableNameCell } from "./DataTable";

const COLUMNS = [
  { key: "label", label: "Label" },
  { key: "kind", label: "Kind" },
];

const ROWS = [
  { id: "1", cells: { label: "Onboard customer", kind: "Process" } },
  { id: "2", cells: { label: "Billing", kind: "Business domain" } },
];

const NAME_COLUMNS = [{ key: "name", label: "Name" }];
const NAME_ROWS = [
  { id: "1", cells: { name: <DataTableNameCell label="Onboard customer" id="urn:weave:process:onboard-customer" /> } },
  { id: "2", cells: { name: <DataTableNameCell label="Billing" id="urn:weave:businessdomain:billing" /> } },
];

const meta: Meta<typeof DataTable> = {
  title: "Organisms/DataTable",
  component: DataTable,
};
export default meta;

type Story = StoryObj<typeof DataTable>;

export const Default: Story = { args: { columns: COLUMNS, rows: ROWS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { columns: COLUMNS, rows: [], loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
export const Empty: Story = { args: { columns: COLUMNS, rows: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };
export const Error: Story = { args: { columns: COLUMNS, rows: [], errorMessage: "Couldn't load rows." } };
export const ErrorDark: Story = { ...Error, parameters: { theme: "dark" } };
export const Selected: Story = { args: { columns: COLUMNS, rows: ROWS, selectedRowId: "1" } };
export const SelectedDark: Story = { ...Selected, parameters: { theme: "dark" } };

export const NameCells: Story = { args: { columns: NAME_COLUMNS, rows: NAME_ROWS } };
export const NameCellsDark: Story = { ...NameCells, parameters: { theme: "dark" } };

export const RowActions: Story = {
  args: {
    columns: COLUMNS,
    rows: ROWS,
    renderRowActions: () => (
      <>
        <button aria-label="Edit">✎</button>
        <button aria-label="Delete">🗑</button>
      </>
    ),
  },
};
export const RowActionsDark: Story = { ...RowActions, parameters: { theme: "dark" } };

export const Expandable: Story = {
  args: {
    columns: COLUMNS,
    rows: ROWS,
    expandable: {
      expandedRowId: "1",
      onToggleRow: () => {},
      renderDetail: (row) => <span>Detail for {row.id}</span>,
    },
  },
};
export const ExpandableDark: Story = { ...Expandable, parameters: { theme: "dark" } };

export const WithPagination: Story = {
  args: {
    columns: COLUMNS,
    rows: ROWS,
    pagination: { page: 1, pageCount: 4, rangeLabel: "Showing 1–2 of 8", onPageChange: () => {} },
  },
};
export const WithPaginationDark: Story = { ...WithPagination, parameters: { theme: "dark" } };

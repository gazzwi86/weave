import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataTable } from "./DataTable";

const COLUMNS = [
  { key: "label", label: "Label" },
  { key: "kind", label: "Kind" },
];

const ROWS = [
  { id: "1", cells: { label: "Onboard customer", kind: "Process" } },
  { id: "2", cells: { label: "Billing", kind: "Business domain" } },
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

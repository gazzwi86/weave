import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FilterForm, type FilterFormField } from "./FilterForm";

const meta: Meta<typeof FilterForm> = {
  title: "Molecules/FilterForm",
  component: FilterForm,
};
export default meta;

type Story = StoryObj<typeof FilterForm>;

const noop = () => undefined;

const AUDIT_LOG_FIELDS: FilterFormField[] = [
  { id: "engine", label: "Engine", type: "select", value: "ce", onChange: noop, options: [{ value: "ce", label: "Constitution" }, { value: "build", label: "Build" }], width: "120px" },
  { id: "event-type", label: "Event type", type: "select", value: "all", onChange: noop, options: [{ value: "all", label: "All" }], width: "150px" },
  { id: "actor", label: "Actor", type: "text", value: "", onChange: noop, placeholder: "Search actors…", width: "180px" },
  { id: "target", label: "Target", type: "text", value: "", onChange: noop, width: "160px" },
  { id: "from", label: "From", type: "date", value: "2026-07-01", onChange: noop, width: "128px" },
  { id: "to", label: "To", type: "date", value: "2026-07-17", onChange: noop, width: "128px" },
  { id: "contains", label: "Contains", type: "text", value: "", onChange: noop, grow: true },
];

const SIMPLE_FIELDS: FilterFormField[] = [
  { id: "status", label: "Status", type: "select", value: "active", onChange: noop, options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }] },
];

export const AuditLogsLike: Story = { args: { fields: AUDIT_LOG_FIELDS, onApply: noop, onReset: noop } };
export const AuditLogsLikeDark: Story = { ...AuditLogsLike, parameters: { theme: "dark" } };

export const Simple: Story = { args: { fields: SIMPLE_FIELDS, onApply: noop, onReset: noop } };
export const SimpleDark: Story = { ...Simple, parameters: { theme: "dark" } };

const CUSTOM_FIELD_FIELDS: FilterFormField[] = [
  {
    id: "actor",
    label: "Actor",
    type: "text",
    value: "",
    onChange: noop,
    width: "180px",
    render: () => (
      <>
        <label
          htmlFor="ff-field-actor-custom"
          className="text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase"
        >
          Actor (typeahead)
        </label>
        <input id="ff-field-actor-custom" placeholder="Type a name…" className="h-[var(--space-6)] rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] px-[var(--space-2)] text-[length:var(--text-body-sm)]" />
      </>
    ),
  },
  { id: "contains", label: "Contains", type: "text", value: "", onChange: noop, grow: true },
];

export const WithCustomField: Story = { args: { fields: CUSTOM_FIELD_FIELDS, onApply: noop, onReset: noop } };
export const WithCustomFieldDark: Story = { ...WithCustomField, parameters: { theme: "dark" } };

export const Default: Story = AuditLogsLike;
export const DefaultDark: Story = AuditLogsLikeDark;

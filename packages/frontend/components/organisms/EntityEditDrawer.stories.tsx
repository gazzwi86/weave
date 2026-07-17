import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RelationshipsEditor } from "../molecules/RelationshipsEditor";
import { EntityEditDrawer } from "./EntityEditDrawer";

const meta: Meta<typeof EntityEditDrawer> = {
  title: "Organisms/EntityEditDrawer",
  component: EntityEditDrawer,
};
export default meta;

type Story = StoryObj<typeof EntityEditDrawer>;

const noop = () => undefined;

/** New entity -- no Delete affordance (nothing to delete yet), no relationships yet. */
export const Default: Story = {
  args: {
    open: true,
    icon: "tag",
    tone: "var(--color-accent-primary)",
    title: "New instance",
    label: "",
    onLabelChange: noop,
    description: "",
    onDescriptionChange: noop,
    onClose: noop,
    onSave: noop,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const New: Story = { ...Default };
export const NewDark: Story = { ...DefaultDark };

export const EditWithRels: Story = {
  args: {
    ...Default.args,
    title: "Edit — Onboard vendor",
    label: "Onboard vendor",
    description: "A repeatable series of activities that turns a trigger into an outcome.",
    onDelete: noop,
    relationships: (
      <RelationshipsEditor
        hideLabel
        rels={[
          { predicate: "related to", target: "Vendor risk policy" },
          { predicate: "governs", target: "Compliance officer" },
        ]}
        onAdd={noop}
        onRemove={noop}
      />
    ),
  },
};
export const EditWithRelsDark: Story = { ...EditWithRels, parameters: { theme: "dark" } };

export const WithKindFields: Story = {
  args: {
    ...Default.args,
    icon: "tag",
    title: "Edit kind — Process",
    label: "Process",
    description: "A repeatable series of activities that turns a trigger into an outcome the business cares about.",
    onDelete: noop,
    kindFields: (
      <div className="flex flex-col gap-[var(--space-1)]">
        <label className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">Colour</label>
        <div className="flex gap-[var(--space-2)]">
          <span className="h-[var(--space-4)] w-[var(--space-4)] rounded-[var(--radius-full)] bg-[var(--color-kind-process)]" />
          <span className="h-[var(--space-4)] w-[var(--space-4)] rounded-[var(--radius-full)] bg-[var(--color-kind-activity)]" />
        </div>
      </div>
    ),
  },
};
export const WithKindFieldsDark: Story = { ...WithKindFields, parameters: { theme: "dark" } };

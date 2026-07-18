import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { RelationshipsEditor, type Relationship } from "./RelationshipsEditor";

const meta: Meta<typeof RelationshipsEditor> = {
  title: "Molecules/RelationshipsEditor",
  component: RelationshipsEditor,
};
export default meta;

type Story = StoryObj<typeof RelationshipsEditor>;

const noop = () => undefined;

/** Interactive wrapper -- lets Storybook's controls/interaction addon
 * actually add/remove chips rather than freezing the args snapshot. */
function Interactive({ initial }: { initial: Relationship[] }) {
  const [rels, setRels] = useState(initial);
  return (
    <RelationshipsEditor
      rels={rels}
      onAdd={(predicate, target) => setRels((current) => [...current, { predicate, target }])}
      onRemove={(index) => setRels((current) => current.filter((_, i) => i !== index))}
    />
  );
}

export const Empty: Story = {
  args: { rels: [], onAdd: noop, onRemove: noop },
  render: () => <Interactive initial={[]} />,
};
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };

export const Default: Story = {
  args: {
    rels: [{ predicate: "related to", target: "Vendor risk policy" }],
    onAdd: noop,
    onRemove: noop,
  },
  render: () => <Interactive initial={[{ predicate: "related to", target: "Vendor risk policy" }]} />,
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Populated: Story = { ...Default };
export const PopulatedDark: Story = { ...DefaultDark };

export const Many: Story = {
  args: {
    rels: [
      { predicate: "related to", target: "Vendor risk policy" },
      { predicate: "governs", target: "Onboard vendor" },
      { predicate: "uses", target: "Compliance officer" },
      { predicate: "broader", target: "Risk management" },
      { predicate: "narrower", target: "EU data residency" },
    ],
    onAdd: noop,
    onRemove: noop,
  },
  render: (args) => <Interactive initial={args.rels} />,
};
export const ManyDark: Story = { ...Many, parameters: { theme: "dark" } };

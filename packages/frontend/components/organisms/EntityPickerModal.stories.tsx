import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { EntityPickerModal, type EntityPickerOption } from "./EntityPickerModal";

const options: EntityPickerOption[] = [
  { id: "e1", label: "Onboard vendor", kind: "process", kindLabel: "Process" },
  { id: "e2", label: "Compliance officer", kind: "actor", kindLabel: "Actor" },
  { id: "e3", label: "Vendor risk policy", kind: "policy", kindLabel: "Policy" },
];

const meta: Meta<typeof EntityPickerModal> = {
  title: "Organisms/EntityPickerModal",
  component: EntityPickerModal,
};
export default meta;

type Story = StoryObj<typeof EntityPickerModal>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    open: true,
    onClose: noop,
    onConfirm: noop,
    options,
    selectedIds: [],
    onToggle: noop,
    search: { value: "", onChange: noop },
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Preselected: Story = {
  ...Default,
  args: { ...Default.args, selectedIds: ["e1", "e3"] },
};
export const PreselectedDark: Story = { ...Preselected, parameters: { theme: "dark" } };

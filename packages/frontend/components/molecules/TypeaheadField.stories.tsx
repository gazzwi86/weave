import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { TypeaheadField, type TypeaheadOption } from "./TypeaheadField";

const OPTIONS: TypeaheadOption[] = [
  { value: "order-created", label: "Order Created", sub: "urn:weave:event:order-created" },
  { value: "order-shipped", label: "Order Shipped", sub: "urn:weave:event:order-shipped" },
  { value: "order-cancelled", label: "Order Cancelled", sub: "urn:weave:event:order-cancelled" },
];

const meta: Meta<typeof TypeaheadField> = {
  title: "Molecules/TypeaheadField",
  component: TypeaheadField,
};
export default meta;

type Story = StoryObj<typeof TypeaheadField>;

function Harness(props: { initialValue: string; initialOpen: boolean; picked?: boolean }) {
  const [value, setValue] = useState(props.initialValue);
  const [open, setOpen] = useState(props.initialOpen);
  return (
    <TypeaheadField
      id="ta-story"
      label="Event kind"
      value={value}
      onValueChange={setValue}
      options={OPTIONS}
      open={open}
      onOpenChange={setOpen}
      onPick={(option) => setValue(option.label)}
      placeholder="Search event kinds..."
    />
  );
}

export const Closed: Story = {
  render: () => <Harness initialValue="" initialOpen={false} />,
};

export const ClosedDark: Story = {
  render: () => <Harness initialValue="" initialOpen={false} />,
  parameters: { theme: "dark" },
};

export const Open: Story = {
  render: () => <Harness initialValue="Order" initialOpen={true} />,
};

export const OpenDark: Story = {
  render: () => <Harness initialValue="Order" initialOpen={true} />,
  parameters: { theme: "dark" },
};

export const Picked: Story = {
  render: () => <Harness initialValue="Order Shipped" initialOpen={false} />,
};

export const PickedDark: Story = {
  render: () => <Harness initialValue="Order Shipped" initialOpen={false} />,
  parameters: { theme: "dark" },
};

// Manifest state aliases (design-system-manifest.ts states: ["default", "selected"]).
export const Default: Story = Closed;
export const DefaultDark: Story = ClosedDark;
export const Selected: Story = Picked;
export const SelectedDark: Story = PickedDark;

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Atoms/Button",
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

// AC-4 closed-state coverage (default/hover/loading x light/dark).
export const Default: Story = { args: { children: "Save" } };
export const DefaultDark: Story = { args: { children: "Save" }, parameters: { theme: "dark" } };
export const Hover: Story = { args: { children: "Save" }, parameters: { pseudo: { hover: true } } };
export const HoverDark: Story = {
  args: { children: "Save" },
  parameters: { pseudo: { hover: true }, theme: "dark" },
};
export const Loading: Story = { args: { children: "Save", loading: true } };
export const LoadingDark: Story = {
  args: { children: "Save", loading: true },
  parameters: { theme: "dark" },
};

export const Primary: Story = {
  args: { variant: "primary", children: "Save" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Cancel" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete" },
};

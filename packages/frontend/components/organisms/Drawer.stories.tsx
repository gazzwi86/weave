import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../ui/button";
import { Drawer } from "./Drawer";

const meta: Meta<typeof Drawer> = {
  title: "Organisms/Drawer",
  component: Drawer,
};
export default meta;

type Story = StoryObj<typeof Drawer>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    open: true,
    icon: "pencil",
    tone: "var(--color-accent-primary)",
    title: "Edit entity",
    onClose: noop,
    children: <p>Drawer body content.</p>,
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Lg: Story = { ...Default, args: { ...Default.args, size: "lg", title: "Edit entity (lg)" } };
export const Xl: Story = { ...Default, args: { ...Default.args, size: "xl", title: "Edit entity (xl)" } };
export const Doc: Story = { ...Default, args: { ...Default.args, size: "doc", title: "Brief" } };

export const WithDangerFoot: Story = {
  args: {
    ...Default.args,
    title: "Edit entity",
    pill: <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">TASK-008</span>,
    dangerSlot: (
      <Button variant="ghost" className="text-[var(--color-danger)]">
        Delete
      </Button>
    ),
    footer: (
      <>
        <Button variant="secondary" onClick={noop}>
          Cancel
        </Button>
        <Button variant="primary" onClick={noop}>
          Save
        </Button>
      </>
    ),
  },
};
export const WithDangerFootDark: Story = { ...WithDangerFoot, parameters: { theme: "dark" } };

export const LongBody: Story = {
  args: {
    ...Default.args,
    title: "Long body",
    children: (
      <div className="flex flex-col gap-[var(--space-3)]">
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>Body paragraph {i + 1} -- verifies internal scroll, not page scroll.</p>
        ))}
      </div>
    ),
  },
};
export const LongBodyDark: Story = { ...LongBody, parameters: { theme: "dark" } };

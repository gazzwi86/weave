import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Icon } from "@/components/ui/icon";

import { BellPanel } from "./BellPanel";

const meta: Meta<typeof BellPanel> = {
  title: "Organisms/BellPanel",
  component: BellPanel,
};
export default meta;

type Story = StoryObj<typeof BellPanel>;

const TODAY = new Date().toISOString();
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export const Default: Story = {
  args: {
    notifications: [
      { id: "1", label: "Ontology published", eventType: "ontology.version.published", read: false, createdAt: TODAY, targetIri: "urn:weave:entity:acme", category: "model" },
      { id: "2", label: "Budget cap reached", eventType: "billing.cap.warning", read: true, createdAt: YESTERDAY },
    ],
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Empty: Story = { args: { notifications: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };

// refit-mock.html's flyout-head close slot -- the wrapper supplies the
// real Dialog.Close element, BellPanel only places it (see closeSlot doc).
export const WithCloseSlot: Story = {
  args: {
    ...Default.args,
    closeSlot: (
      <button type="button" aria-label="Close notifications" className="flex h-[26px] w-[26px] items-center justify-center">
        <Icon name="x" size={14} />
      </button>
    ),
  },
};

// AC-6: audit.chain.invalid renders with no mute control for the admin role.
export const NonSuppressibleAuditAlert: Story = {
  args: {
    notifications: [
      { id: "1", label: "Chain verification failed", eventType: "audit.chain.invalid", read: false, createdAt: TODAY },
    ],
    role: "workspace_admin",
    onMute: fn(),
    onMarkRead: fn(),
  },
};

// Coverage: mark-read, mark-all-read, and mute handlers, each exercised by a
// real DOM click -- static-args-only stories never trigger these.
export const Interactive: Story = {
  args: {
    notifications: [
      { id: "1", label: "Ontology published", eventType: "ontology.version.published", read: false, createdAt: TODAY },
      { id: "2", label: "Job done", eventType: "job.completed", read: false, createdAt: TODAY },
    ],
    onMarkRead: fn(),
    onMarkAllRead: fn(),
    onMute: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getAllByRole("button", { name: "Mark read" })[0]!);
    expect(args.onMarkRead).toHaveBeenCalledWith("1");

    await userEvent.click(canvas.getAllByRole("button", { name: "Mute" })[0]!);
    expect(args.onMute).toHaveBeenCalledWith("ontology.version.published");

    await userEvent.click(canvas.getByRole("button", { name: "Mark all read" }));
    expect(args.onMarkAllRead).toHaveBeenCalledTimes(1);
  },
};

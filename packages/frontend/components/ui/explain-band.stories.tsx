import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button";
import { ExplainBand } from "./explain-band";

const meta: Meta<typeof ExplainBand> = {
  title: "Atoms/ExplainBand",
  component: ExplainBand,
};
export default meta;

type Story = StoryObj<typeof ExplainBand>;

export const Default: Story = {
  args: {
    tone: "accent",
    icon: "graph",
    body: (
      <>
        <b className="text-[var(--color-text-default)]">How Weave works:</b> you model how the
        business runs in the Constitution, then Weave builds and runs apps grounded in that model.
      </>
    ),
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Warn: Story = {
  args: {
    tone: "warn",
    icon: "alert-triangle",
    body: (
      <>
        <b className="text-[var(--color-text-default)]">Review gate waiting on you:</b> QA passed
        the RMA-approval flow — approve to let the build continue.
      </>
    ),
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    icon: "check",
    body: (
      <>
        <b className="text-[var(--color-text-default)]">Everything checks out.</b> The audit chain
        verifies end-to-end and every governed kind has at least one active rule.
      </>
    ),
  },
};

export const Danger: Story = {
  args: {
    tone: "danger",
    icon: "alert-triangle",
    body: (
      <>
        <b className="text-[var(--color-text-default)]">The audit chain is broken.</b> One or more
        entities have no active policy coverage.
      </>
    ),
  },
};

export const WithAction: Story = {
  args: {
    tone: "warn",
    icon: "pencil",
    body: (
      <>
        <b className="text-[var(--color-text-default)]">Draft — 6 changes since v14</b> by you,
        Marco and the Build agent.
      </>
    ),
    action: (
      <Button variant="secondary" className="shrink-0">
        Publish
      </Button>
    ),
  },
};

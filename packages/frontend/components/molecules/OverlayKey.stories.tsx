import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { OverlayKey, type OverlaySection } from "./OverlayKey";

const meta: Meta<typeof OverlayKey> = {
  title: "Molecules/OverlayKey",
  component: OverlayKey,
};
export default meta;

type Story = StoryObj<typeof OverlayKey>;

const MULTI_OVERLAY_SECTIONS: OverlaySection[] = [
  {
    id: "heat",
    label: "heat",
    rows: [
      { colorVar: "--color-danger", label: "changed 5+ times this month" },
      { colorVar: "--color-warn", label: "changed 2–4 times" },
      { colorVar: "--color-border-strong", label: "stable" },
    ],
  },
  {
    id: "diff",
    label: "diff v13 → v14",
    rows: [
      { colorVar: "--color-success", label: "added in v14" },
      { colorVar: "--color-warn", label: "changed in v14" },
      { colorVar: "--color-danger", label: "removed (ghost)" },
    ],
  },
];

export const MultiOverlay: Story = { args: { sections: MULTI_OVERLAY_SECTIONS } };
export const MultiOverlayDark: Story = { ...MultiOverlay, parameters: { theme: "dark" } };

export const Default: Story = MultiOverlay;
export const DefaultDark: Story = MultiOverlayDark;

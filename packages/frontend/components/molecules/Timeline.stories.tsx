import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Timeline, type TimelineEntry } from "./Timeline";

const meta: Meta<typeof Timeline> = {
  title: "Molecules/Timeline",
  component: Timeline,
};
export default meta;

type Story = StoryObj<typeof Timeline>;

const noop = () => undefined;
const VIEW_ON_CANVAS = { label: "View on canvas", onClick: noop };

const VERSIONS_ENTRIES: TimelineEntry[] = [
  {
    id: "v14",
    version: "v14",
    timestamp: "2026-07-17 09:12",
    author: "Priya Shah",
    description: "6 changes — refund step added to Order handling; Refund policy threshold; 4 property edits.",
    latest: true,
    actions: [{ label: "Diff vs v13", onClick: noop }, VIEW_ON_CANVAS],
  },
  {
    id: "v13",
    version: "v13",
    timestamp: "2026-07-12 15:40",
    author: "Marco Diaz",
    description: "11 changes — Fulfilment capability remodelled; Dispatch activity split.",
    actions: [{ label: "Diff vs v12", onClick: noop }, VIEW_ON_CANVAS],
  },
  {
    id: "v12",
    version: "v12",
    timestamp: "2026-07-08 10:05",
    author: "Priya Shah",
    description: "3 changes — initial governance policies attached.",
    actions: [{ label: "Diff vs v11", onClick: noop }, VIEW_ON_CANVAS],
  },
];

export const VersionsLike: Story = { args: { entries: VERSIONS_ENTRIES } };
export const VersionsLikeDark: Story = { ...VersionsLike, parameters: { theme: "dark" } };

export const Default: Story = VersionsLike;
export const DefaultDark: Story = VersionsLikeDark;

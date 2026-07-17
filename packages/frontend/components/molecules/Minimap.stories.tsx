import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Minimap, type MinimapNode } from "./Minimap";

const meta: Meta<typeof Minimap> = {
  title: "Molecules/Minimap",
  component: Minimap,
  decorators: [(Story) => <div style={{ width: 160, height: 100 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof Minimap>;

const NODES: MinimapNode[] = [
  { id: "n1", x: 20, y: 10, colorVar: "--color-kind-process" },
  { id: "n2", x: 60, y: 40, colorVar: "--color-kind-actor" },
  { id: "n3", x: 100, y: 70, colorVar: "--color-kind-system" },
];

export const Default: Story = { args: { nodes: NODES, viewportRect: { left: 10, top: 5, width: 60, height: 40 } } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

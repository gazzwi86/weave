import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ControlDock, type ControlDockTab } from "./ControlDock";

const meta: Meta<typeof ControlDock> = {
  title: "Molecules/ControlDock",
  component: ControlDock,
};
export default meta;

type Story = StoryObj<typeof ControlDock>;

const noop = () => undefined;

const TABS: ControlDockTab[] = [
  { id: "filters", label: "Filters", icon: <span aria-hidden="true">F</span>, panel: <p>Kind + property filters go here.</p> },
  { id: "layers", label: "Layers", icon: <span aria-hidden="true">L</span>, panel: <p>Glossary, governance, provenance toggles.</p> },
  { id: "overlays", label: "Overlays", icon: <span aria-hidden="true">O</span>, panel: <p>Change heatmap, impact, version diff.</p> },
  { id: "versions", label: "Versions", icon: <span aria-hidden="true">V</span>, panel: <p>v14 · v13 · v12</p> },
];

export const Closed: Story = { args: { tabs: TABS, activeTab: null, onTabChange: noop } };
export const ClosedDark: Story = { ...Closed, parameters: { theme: "dark" } };

export const FiltersOpen: Story = { args: { tabs: TABS, activeTab: "filters", onTabChange: noop } };
export const FiltersOpenDark: Story = { ...FiltersOpen, parameters: { theme: "dark" } };

export const Default: Story = Closed;
export const DefaultDark: Story = ClosedDark;
export const Selected: Story = FiltersOpen;
export const SelectedDark: Story = FiltersOpenDark;

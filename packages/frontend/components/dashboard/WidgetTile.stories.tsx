import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import type { WidgetOut } from "./types";
import { WidgetTile } from "./widget-tile";

function kpiWidget(overrides: Partial<WidgetOut> = {}): WidgetOut {
  return {
    id: "w-1",
    scope: "tenant_default",
    spec: {
      component_type: "kpi_card",
      title: "Entities in model",
      data_source_contracts: ["CE-METRICS-1"],
      bindings: { field: "entity_count_by_kind", aggregate: "sum" },
      column_span: 3,
    },
    position: 0,
    last_result: 42,
    fetched_at: "2026-07-10T12:00:00Z",
    status: "fresh",
    pending_fields: [],
    suggested: false,
    refresh_interval_s: 300,
    ...overrides,
  };
}

const meta: Meta<typeof WidgetTile> = {
  title: "Organisms/WidgetTile",
  component: WidgetTile,
};
export default meta;

type Story = StoryObj<typeof WidgetTile>;

// H2: a URN KPI value shortens to just its version tag, full URN in `title`.
export const VersionKpi: Story = {
  args: {
    widget: kpiWidget({
      spec: { ...kpiWidget().spec, title: "Latest published version" },
      last_result: "urn:weave:tenant:acme-corp:ws:2b00d676-1234-4a1b-9c3d-abcdef012345:v0.1.6",
    }),
  },
};

// H1: an already-pinned user widget (suggested=false) shows Unpin only.
export const PinnedControls: Story = {
  args: {
    widget: kpiWidget({ scope: "user", suggested: false }),
    onPin: fn(),
    onUnpin: fn(),
  },
};

// H1: a suggested, not-yet-pinned user widget (suggested=true) shows Pin only.
export const UnpinnedControls: Story = {
  args: {
    widget: kpiWidget({ scope: "user", suggested: true }),
    onPin: fn(),
    onUnpin: fn(),
  },
};

// H3: status=stale keeps the retained value and shows the single-word Stale badge.
export const StaleBadge: Story = {
  args: { widget: kpiWidget({ status: "stale", last_result: 42 }) },
};
export const StaleBadgeDark: Story = { ...StaleBadge, parameters: { theme: "dark" } };

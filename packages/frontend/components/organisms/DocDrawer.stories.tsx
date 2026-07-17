import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusPill } from "../ui/status-pill";
import { DocDrawer } from "./DocDrawer";

const meta: Meta<typeof DocDrawer> = {
  title: "Organisms/DocDrawer",
  component: DocDrawer,
};
export default meta;

type Story = StoryObj<typeof DocDrawer>;

const noop = () => undefined;

export const Default: Story = {
  args: {
    open: true,
    title: "Brief",
    onClose: noop,
    meta: ["Updated 2026-07-17", "v3", "Approved"],
    children: (
      <>
        <h3>Problem</h3>
        <p>
          The built app diverged from the approved design direction -- nav, styling and animation drifted section by
          section as it was built without a living reference.
        </p>
        <h3>Approach</h3>
        <ul>
          <li>Extend the living mock, get sign-off, then roll out section by section.</li>
          <li>Every UI change is council-reviewed and screenshot-verified before merge.</li>
        </ul>
      </>
    ),
  },
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const BriefLike: Story = { ...Default };
export const BriefLikeDark: Story = { ...DefaultDark };

export const EpicsLike: Story = {
  args: {
    open: true,
    title: "Epics",
    onClose: noop,
    meta: ["4 epics", "12 stories"],
    children: (
      <>
        <h3>
          EPIC-011 -- Design-system uplift <StatusPill status="published" />
        </h3>
        <p>Storybook atomic library, app-shell v2, and the token-driven refit of every screen.</p>
        <h3>
          EPIC-014 -- Governance cascade <StatusPill status="active" />
        </h3>
        <p>Publish/version/audit workflows for the graph.</p>
      </>
    ),
  },
};
export const EpicsLikeDark: Story = { ...EpicsLike, parameters: { theme: "dark" } };

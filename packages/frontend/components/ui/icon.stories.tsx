import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Icon, type IconName } from "./icon";

const meta: Meta<typeof Icon> = {
  title: "Atoms/Icon",
  component: Icon,
};
export default meta;

type Story = StoryObj<typeof Icon>;

const NAMES: IconName[] = [
  "home",
  "graph",
  "layers",
  "zap",
  "scroll",
  "gear",
  "bell",
  "help",
  "search",
  "plus",
  "chev-d",
  "x",
  "check",
  "check-all",
  "panel-close",
  "panel-open",
  "sparkles",
  "book",
  "play",
  "msg",
  "keyboard",
  "user",
  "swap",
  "moon",
  "logout",
];

export const Default: Story = { args: { name: "home" } };

export const AllIcons: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {NAMES.map((name) => (
        <Icon key={name} name={name} size={20} />
      ))}
    </div>
  ),
};

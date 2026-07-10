import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { CommandBar } from "./CommandBar";

const RESULTS = [
  { id: "wv:process-1", label: "Onboard customer" },
  { id: "wv:process-2", label: "Close invoice" },
];

const meta: Meta<typeof CommandBar> = {
  title: "Organisms/CommandBar",
  component: CommandBar,
};
export default meta;

type Story = StoryObj<typeof CommandBar>;

export const Default: Story = { args: { query: "onboard", results: RESULTS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { query: "onboard", results: [], loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };
export const Empty: Story = { args: { query: "zzz", results: [] } };
export const EmptyDark: Story = { ...Empty, parameters: { theme: "dark" } };

// Coverage (TASK-026 retry): onQueryChange (search input) and onSelect
// (result click) handlers were never exercised by any story --
// static-args-only stories never trigger a real DOM input/click.
export const Interactive: Story = {
  args: { query: "onboard", results: RESULTS, onQueryChange: fn(), onSelect: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByRole("textbox", { name: "Search entities" }), "x");
    expect(args.onQueryChange).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Onboard customer" }));
    expect(args.onSelect).toHaveBeenCalledWith("wv:process-1");
  },
};

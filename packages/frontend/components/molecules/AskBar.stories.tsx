import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AskBar } from "./AskBar";

const meta: Meta<typeof AskBar> = {
  title: "Molecules/AskBar",
  component: AskBar,
};
export default meta;

type Story = StoryObj<typeof AskBar>;

export const Default: Story = { args: {} };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };
export const Loading: Story = { args: { value: "How many processes reference Billing?", loading: true } };
export const LoadingDark: Story = { ...Loading, parameters: { theme: "dark" } };

// QA edge case (TASK-026): AskBar's onChange/onSubmit handler bodies were never
// exercised by any story -- static-args-only stories never trigger a real DOM
// input/submit event, leaving lines 21-29 uncovered. This drives real user
// interaction through the wired handlers.
export const Interactive: Story = {
  args: { onChange: fn(), onSubmit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Ask a question" });

    await userEvent.type(input, "Who owns Billing?");
    expect(args.onChange).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Ask" }));
    expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

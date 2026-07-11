import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardContent, CardTitle } from "./card";

const meta: Meta<typeof Card> = {
  title: "Atoms/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardTitle>Constitution Engine</CardTitle>
      <CardContent>The graph/ontology layer — ships first.</CardContent>
    </Card>
  ),
};
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

export const Selected: Story = {
  render: () => (
    <Card selected>
      <CardTitle>Constitution Engine</CardTitle>
      <CardContent>The graph/ontology layer — ships first.</CardContent>
    </Card>
  ),
};
export const SelectedDark: Story = { ...Selected, parameters: { theme: "dark" } };

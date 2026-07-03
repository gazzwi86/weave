import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardContent, CardTitle } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
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

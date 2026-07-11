import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { PromptBar } from "../prompt-bar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const SPEC_EVENT =
  'event: spec\ndata: {"component_type":"kpi_card","title":"Entities in model",' +
  '"data_source_contracts":["CE-METRICS-1"],"bindings":{},"column_span":3}\n\n';
const DONE_EVENT = 'event: done\ndata: {"token_count":12,"widget_id":"w-9"}\n\n';
const ERROR_EVENT =
  'event: error\ndata: {"state":"provider_503","reason":"AI provider unavailable"}\n\n';

function stubFetch(handler: (url: string) => Response | Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => handler(String(input))));
}

describe("PromptBar", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations when open", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ prompts: ["show entities"], hide_after: 3 }), { status: 200 })
    );
    const { container } = render(<PromptBar generatedCount={0} />);
    fireEvent.click(screen.getByTestId("prompt-bar-trigger"));
    await screen.findByRole("dialog");

    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("shows example prompts when empty and under the hide-after count", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ prompts: ["show entities by kind"], hide_after: 3 }), {
        status: 200,
      })
    );
    render(<PromptBar generatedCount={0} />);
    fireEvent.click(screen.getByTestId("prompt-bar-trigger"));

    expect(await screen.findByText("show entities by kind")).toBeInTheDocument();
  });

  it("hides example prompts once the user has generated 3 widgets", async () => {
    stubFetch(() =>
      new Response(JSON.stringify({ prompts: ["show entities by kind"], hide_after: 3 }), {
        status: 200,
      })
    );
    render(<PromptBar generatedCount={3} />);
    fireEvent.click(screen.getByTestId("prompt-bar-trigger"));
    await screen.findByRole("dialog");

    expect(screen.queryByText("show entities by kind")).not.toBeInTheDocument();
  });

  it("streams a prompt to a rendered spec and terminal done state", async () => {
    stubFetch((url) => {
      if (url.includes("example-prompts")) {
        return new Response(JSON.stringify({ prompts: [], hide_after: 3 }), { status: 200 });
      }
      return sseResponse([SPEC_EVENT, DONE_EVENT]);
    });
    render(<PromptBar generatedCount={0} />);
    fireEvent.click(screen.getByTestId("prompt-bar-trigger"));
    const input = await screen.findByRole("textbox", { name: /describe the view/i });
    fireEvent.change(input, { target: { value: "show entities" } });
    fireEvent.submit(input.closest("form")!);

    await screen.findByText("Entities in model");
    await waitFor(() => expect(screen.getByTestId("prompt-bar-status")).toHaveTextContent("CE-METRICS-1"));
  });

  it("renders a named, retryable state for provider_503", async () => {
    stubFetch((url) => {
      if (url.includes("example-prompts")) {
        return new Response(JSON.stringify({ prompts: [], hide_after: 3 }), { status: 200 });
      }
      return sseResponse([ERROR_EVENT]);
    });
    render(<PromptBar generatedCount={0} />);
    fireEvent.click(screen.getByTestId("prompt-bar-trigger"));
    const input = await screen.findByRole("textbox", { name: /describe the view/i });
    fireEvent.change(input, { target: { value: "show entities" } });
    fireEvent.submit(input.closest("form")!);

    expect(await screen.findByText("AI provider unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});

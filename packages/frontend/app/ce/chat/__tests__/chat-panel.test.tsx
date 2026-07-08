import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ChatPanel } from "../chat-panel";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stubFetch(handler: (url: string) => Response): void {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => handler(String(input))));
}

async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

describe("ChatPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  // AC-006-01: the panel is visible/usable as soon as the workspace opens.
  it("has no axe violations", async () => {
    const { container } = render(<ChatPanel />);
    await expectNoAxeViolations(container);
  });

  // AC-006-02/AC-006-03/AC-006-12: type a message, see the proposal with
  // its explanation, confirm it, see the committed IRI.
  it("proposes then confirms an add_node operation end to end", async () => {
    stubFetch((url) => {
      if (url.includes("/api/ontology/authoring/nl")) {
        return jsonResponse(200, {
          operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "Customer Onboarding" }],
        });
      }
      return jsonResponse(201, {
        activity_iri: "urn:a",
        applied_count: 1,
        version_iri: "urn:v1",
        ref_map: { p1: "urn:weave:process:p1" },
      });
    });
    render(<ChatPanel />);

    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Add a Process called Customer Onboarding" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument());
    expect(screen.getAllByText(/Customer Onboarding/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(screen.getByRole("link", { name: /urn:weave:process:p1/ })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /urn:weave:process:p1/ })).toHaveAttribute(
      "href",
      `/explorer?focus=${encodeURIComponent("urn:weave:process:p1")}`
    );
  });

  // AC-006-06: three intentionally vague prompts each trigger a clarifying
  // question instead of a guess.
  it.each(["make it better", "do the thing", "update it"])(
    "asks a clarifying question for a vague prompt: %s",
    async (prompt) => {
      stubFetch(() => jsonResponse(422, { error: "nl_parse_failed", message: "Which entity do you mean?" }));
      render(<ChatPanel />);

      fireEvent.change(screen.getByLabelText(/message/i), { target: { value: prompt } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => expect(screen.getByText(/Which entity do you mean\?/)).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    }
  );

  it("clears the proposal on reject without dispatching", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { operations: [{ op: "add_node", ref: "p1", kind: "Process", label: "X" }] })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatPanel />);

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Add a Process called X" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

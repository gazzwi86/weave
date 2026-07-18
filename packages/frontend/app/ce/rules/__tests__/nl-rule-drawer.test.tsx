import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NlRuleDrawer } from "../nl-rule-drawer";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NlRuleDrawer", () => {
  it("previews then commits a rule, ai_generated true when the turtle is untouched", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).endsWith("/preview")) {
        return jsonResponse(200, { shape_turtle: "weave:FooShape a sh:NodeShape ." });
      }
      return jsonResponse(201, { shape_iri: "urn:weave:shapes:FooShape" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onCommitted = vi.fn();

    render(<NlRuleDrawer onClose={vi.fn()} onCommitted={onCommitted} />);

    fireEvent.change(screen.getByLabelText("Describe the rule"), {
      target: { value: "Every Foo must have a bar." },
    });
    fireEvent.click(screen.getByText("Preview"));

    await waitFor(() => expect(screen.getByDisplayValue("weave:FooShape a sh:NodeShape .")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Commit"));

    await waitFor(() => expect(onCommitted).toHaveBeenCalledWith("urn:weave:shapes:FooShape"));
    const commitCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/commit"));
    expect(commitCall?.[1]).toMatchObject({
      body: JSON.stringify({ shape_turtle: "weave:FooShape a sh:NodeShape .", ai_generated: true }),
    });
  });

  it("marks ai_generated false once the previewed turtle is hand-edited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, _init?: RequestInit) => {
        if (String(url).endsWith("/preview")) {
          return jsonResponse(200, { shape_turtle: "weave:FooShape a sh:NodeShape ." });
        }
        return jsonResponse(201, { shape_iri: "urn:weave:shapes:FooShape" });
      })
    );

    render(<NlRuleDrawer onClose={vi.fn()} onCommitted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Describe the rule"), { target: { value: "Every Foo must have a bar." } });
    fireEvent.click(screen.getByText("Preview"));
    await waitFor(() => screen.getByDisplayValue("weave:FooShape a sh:NodeShape ."));

    fireEvent.change(screen.getByDisplayValue("weave:FooShape a sh:NodeShape ."), {
      target: { value: "weave:FooShape a sh:NodeShape ; sh:severity sh:Warning ." },
    });
    fireEvent.click(screen.getByText("Commit"));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/ontology/authoring/nl/shapes/commit", expect.anything()));
    const commitCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/commit"));
    expect(commitCall?.[1]).toMatchObject({
      body: JSON.stringify({
        shape_turtle: "weave:FooShape a sh:NodeShape ; sh:severity sh:Warning .",
        ai_generated: false,
      }),
    });
  });

  it("shows the 503 message inline instead of crashing (graceful degradation)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, { error: "model_provider_unavailable" })));

    render(<NlRuleDrawer onClose={vi.fn()} onCommitted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Describe the rule"), { target: { value: "Every Foo must have a bar." } });
    fireEvent.click(screen.getByText("Preview"));

    await waitFor(() => expect(screen.getByText("model_provider_unavailable")).toBeInTheDocument());
  });

  it("surfaces a 422 invalid_shape commit error inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/preview")) {
          return jsonResponse(200, { shape_turtle: "weave:FooShape a sh:NodeShape ." });
        }
        return jsonResponse(422, { error: "invalid_shape", message: "Not valid SHACL." });
      })
    );

    render(<NlRuleDrawer onClose={vi.fn()} onCommitted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Describe the rule"), { target: { value: "Every Foo must have a bar." } });
    fireEvent.click(screen.getByText("Preview"));
    await waitFor(() => screen.getByDisplayValue("weave:FooShape a sh:NodeShape ."));

    fireEvent.click(screen.getByText("Commit"));

    await waitFor(() => expect(screen.getByText("Not valid SHACL.")).toBeInTheDocument());
  });
});

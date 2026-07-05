import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import CePage from "../page";

const PROCESS_KIND = { iri: "urn:weave:kind:Process", label: "Process", properties: [] };

function stubFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ kinds: [PROCESS_KIND], relationships: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
  );
}

describe("CePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubFetch();
    const { container } = render(<CePage />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: /add entity/i })).toBeInTheDocument());
    expect((await axe(container)).violations).toHaveLength(0);
  });

  // AC-006-01: chat panel + entity-authoring trigger both live on the CE workspace page.
  it("shows the chat panel and an add-entity kind selector", async () => {
    stubFetch();
    render(<CePage />);
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /add entity/i })).toBeInTheDocument());
  });

  // AC-006-07: selecting a kind opens its SHACL-driven guided form.
  it("opens the guided form for the selected kind", async () => {
    stubFetch();
    render(<CePage />);
    const select = await screen.findByRole("combobox", { name: /add entity/i });

    fireEvent.change(select, { target: { value: PROCESS_KIND.iri } });

    await waitFor(() => expect(screen.getByLabelText(/^label/i)).toBeInTheDocument());
  });
});

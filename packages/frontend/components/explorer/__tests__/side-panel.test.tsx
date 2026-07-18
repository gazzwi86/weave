import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidePanel } from "../side-panel";
import type { UsePanelEditResult } from "../use-panel-edit";

// CommentsPanel (AC-6) fetches on mount -- stub the client so these
// pre-existing tests don't leak a real fetch() call against a relative URL.
vi.mock("@/lib/explorer/comments-client", () => ({
  listComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn(),
}));

describe("SidePanel", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SidePanel state={{ status: "closed" }} onClose={vi.fn()} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the label and type while loading", () => {
    render(
      <SidePanel
        state={{ status: "loading", label: "Customer Onboarding", typeLabel: "Process" }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Customer Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  // AC-2: no raw IRI anywhere in the DOM for a non-ontologist role.
  it("shows properties and never renders a raw IRI when rawIri is null", () => {
    render(
      <SidePanel
        state={{
          status: "loaded",
          label: "Customer Onboarding",
          typeLabel: "Process",
          keyProperties: [{ path: "rdfs:comment", label: "Description", value: "Onboards a new customer" }],
          rawIri: null,
          nodeId: "n1",
          neighbours: [],
        }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Onboards a new customer")).toBeInTheDocument();
    expect(screen.queryByText(/https?:\/\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/advanced/i)).not.toBeInTheDocument();
  });

  // AC-2: the ontologist role gets a disclosed raw IRI.
  it("discloses the raw IRI under an 'Advanced' section when rawIri is set", () => {
    const iri = "https://weave.example/entity/cust-onboarding";
    render(
      <SidePanel
        state={{ status: "loaded", label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: iri, nodeId: "n1", neighbours: [] }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText(/advanced/i)).toBeInTheDocument();
    expect(screen.getByText(iri)).toBeInTheDocument();
  });

  // AC-3: generic fallback keeps label/type and offers retry.
  it("shows the 'Details unavailable' fallback with a retry action on error", () => {
    const onRetry = vi.fn();
    render(
      <SidePanel state={{ status: "error", label: "Customer Onboarding", typeLabel: "Process" }} onClose={vi.fn()} onRetry={onRetry} />
    );
    expect(screen.getByText("Customer Onboarding")).toBeInTheDocument();
    expect(screen.getByText(/details unavailable/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  // AC-8: "Not found" only -- no label/type/properties leak through.
  it("shows only 'Not found' and no other content when not-found", () => {
    render(<SidePanel state={{ status: "not-found" }} onClose={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SidePanel
        state={{ status: "loaded", label: "Customer Onboarding", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
        onClose={onClose}
        onRetry={vi.fn()}
      />
    );
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });

  // TASK-027 AC-4/AC-5: missing-link drill.
  describe("Missing links (TASK-027)", () => {
    const GAPS = [{ missingLink: "https://weave.example/ontology/bpmo#performedBy", label: "performed by" }];

    it("renders no Missing links section when gaps is empty", () => {
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [], gaps: [] }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      expect(screen.queryByText(/missing links/i)).not.toBeInTheDocument();
    });

    // AC-4: humanised label, never a raw predicate IRI.
    it("lists humanised missing links, never a raw predicate IRI", () => {
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [], gaps: GAPS }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      expect(screen.getByText(/missing links/i)).toBeInTheDocument();
      expect(screen.getByText(/performed by/i)).toBeInTheDocument();
      expect(screen.queryByText(/https?:\/\//)).not.toBeInTheDocument();
    });

    // AC-5: edit controller present -> inline shortcut.
    it("offers an inline 'Add <link>…' shortcut when onEditGap is provided", () => {
      const onEditGap = vi.fn();
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [], gaps: GAPS }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
          onEditGap={onEditGap}
        />
      );
      screen.getByRole("button", { name: /add performed by/i }).click();
      expect(onEditGap).toHaveBeenCalledWith("n1", GAPS[0]!.missingLink);
    });

    // AC-5: no edit controller -> CE-surface link fallback.
    it("links to the CE editing surface when onEditGap is absent", () => {
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [], gaps: GAPS }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      expect(screen.queryByRole("button", { name: /add performed by/i })).not.toBeInTheDocument();
      const link = screen.getByRole("link", { name: /performed by/i });
      expect(link.getAttribute("href")).toContain("n1");
    });
  });

  // refit: node.status==="error" renders the shared ErrorCard (with a real
  // retry action), not ad-hoc markup -- the 503 note in TASK summary: this
  // IS the correct rendering for a CE-node-details failure, only the
  // markup changed, not the error-classification logic in use-node-spotlight.ts.
  it("uses the shared ErrorCard for the error state", () => {
    render(
      <SidePanel state={{ status: "error", label: "Customer Onboarding", typeLabel: "Process" }} onClose={vi.fn()} onRetry={vi.fn()} />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // refit: kind-coloured swatch header (glass panel mock's `.canvas-inspector`).
  it("shows a kind-coloured chip in the header when bpmoKind resolves to a known kind", () => {
    const { container } = render(
      <SidePanel
        state={{ status: "loaded", label: "X", typeLabel: "Process", bpmoKind: "process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  it("falls back to plain text (no chip) when bpmoKind is absent or unrecognised", () => {
    render(
      <SidePanel
        state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  describe("Edges (refit)", () => {
    const NEIGHBOURS = [
      {
        iri: "https://weave.example/entity/y",
        label: "Y",
        bpmoKind: "Activity",
        edgePredicate: "https://weave.example/ontology/bpmo#performedBy",
        edgeDirection: "outgoing" as const,
      },
    ];

    it("renders a clickable edge row and calls onOpenNode with the target iri", () => {
      const onOpenNode = vi.fn();
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: NEIGHBOURS }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
          onOpenNode={onOpenNode}
        />
      );
      screen.getByRole("button", { name: /performedBy/i }).click();
      expect(onOpenNode).toHaveBeenCalledWith("https://weave.example/entity/y");
    });

    it("renders no Edges section when the node has no neighbours", () => {
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      expect(screen.queryByText(/^edges$/i)).not.toBeInTheDocument();
    });
  });

  it("shows an Instances link to the instances page", () => {
    render(
      <SidePanel
        state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
        onClose={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole("link", { name: /instances/i }).getAttribute("href")).toBe("/ce/instances");
  });

  describe("Edit via EntityEditDrawer", () => {
    function buildPanelEdit(overrides: Partial<UsePanelEditResult> = {}): UsePanelEditResult {
      return {
        edit: { mode: "view" },
        violationMessages: [],
        deleteConfirm: null,
        deleteFailed: false,
        openEdit: vi.fn(),
        cancelEdit: vi.fn(),
        setLabel: vi.fn(),
        setProperty: vi.fn(),
        save: vi.fn(),
        dismissViolations: vi.fn(),
        requestDelete: vi.fn(),
        confirmDelete: vi.fn(),
        cancelDelete: vi.fn(),
        dismissDeleteFailed: vi.fn(),
        ...overrides,
      };
    }

    it("opens the EntityEditDrawer prefilled with the label and the node's edges when edit mode is active", () => {
      const panelEdit = buildPanelEdit({
        edit: { mode: "edit", form: { label: "Customer Onboarding", properties: {} }, editBase: 0 },
      });
      render(
        <SidePanel
          state={{
            status: "loaded",
            label: "Customer Onboarding",
            typeLabel: "Process",
            keyProperties: [],
            rawIri: null,
            nodeId: "n1",
            neighbours: [
              {
                iri: "https://weave.example/entity/y",
                label: "Y",
                bpmoKind: "Activity",
                edgePredicate: "https://weave.example/ontology/bpmo#performedBy",
                edgeDirection: "outgoing",
              },
            ],
          }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
          panelEdit={panelEdit}
          canEdit
        />
      );
      expect(screen.getByLabelText("Label")).toHaveValue("Customer Onboarding");
      expect(screen.getByText(/performedBy/i)).toBeInTheDocument();
    });

    it("routes the drawer's label field through panelEdit.setLabel", () => {
      const setLabel = vi.fn();
      const panelEdit = buildPanelEdit({
        edit: { mode: "edit", form: { label: "X", properties: {} }, editBase: 0 },
        setLabel,
      });
      render(
        <SidePanel
          state={{ status: "loaded", label: "X", typeLabel: "Process", keyProperties: [], rawIri: null, nodeId: "n1", neighbours: [] }}
          onClose={vi.fn()}
          onRetry={vi.fn()}
          panelEdit={panelEdit}
          canEdit
        />
      );
      fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Y" } });
      expect(setLabel).toHaveBeenCalledWith("Y");
    });
  });
});

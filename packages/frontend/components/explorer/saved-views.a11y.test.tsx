import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CommentsPanel } from "./comments-panel";
import { SavedViewsPanel } from "./saved-views-panel";
import type { UseSavedViewsResult } from "./use-saved-views";

vi.mock("@/lib/explorer/comments-client", () => ({
  listComments: vi.fn().mockResolvedValue([
    { comment_id: "c1", author: "https://weave.io/principal/user/alice", body: "Looks good", created_at: "2026-01-01T00:00:00Z" },
  ]),
  createComment: vi.fn(),
}));

// ponytail: see components/ui/ui.a11y.test.tsx -- vitest-axe's matcher
// augmentation doesn't type-check under vitest 4, so violations are
// asserted directly off axe-core's own result shape.
async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

const SAVED_VIEWS_PROPS: UseSavedViewsResult = {
  views: [
    {
      view_id: "v1",
      name: "Q3 review",
      created_by: "https://weave.io/principal/user/alice",
      pinned: false,
      updated_at: "2026-01-01",
      definition: {
        filterState: { entityTypesOff: [], relTypesOff: [], propertyFilters: [], layersOn: [] },
        activeOverlayIds: [],
        domainFocus: null,
        viewport: { zoom: 1, pan: { x: 0, y: 0 } },
      },
    },
  ],
  refreshLibrary: vi.fn(),
  save: vi.fn().mockResolvedValue({ status: "created", view_id: "v2" }),
  open: vi.fn().mockResolvedValue({ missingCount: 0 }),
  remove: vi.fn().mockResolvedValue(true),
  share: vi.fn().mockResolvedValue({ notified: 1, excluded: 0 }),
};

// TASK-026 AC-8: save/library/share (SavedViewsPanel) and the comment
// composer (CommentsPanel) are keyboard-operable and axe-clean, including
// the freeform share-recipient chip picker (Option-2 deviation).
describe("saved views a11y", () => {
  it("SavedViewsPanel with a populated library has no axe violations", async () => {
    const { container } = render(<SavedViewsPanel {...SAVED_VIEWS_PROPS} />);
    await expectNoAxeViolations(container);
  });

  it("CommentsPanel with an existing thread has no axe violations", async () => {
    const { container, findByText } = render(<CommentsPanel targetKind="node" targetRef="n1" />);
    await findByText("Looks good");
    await expectNoAxeViolations(container);
  });
});

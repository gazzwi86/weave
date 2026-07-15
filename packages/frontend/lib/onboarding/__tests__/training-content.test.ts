import { describe, expect, it } from "vitest";

import { TRAINING_CATEGORIES } from "../../../../shared/onboarding/content/categories";
import type { TrainingEntry } from "../../../../shared/onboarding/content/schema";
import { cardState, filterTraining, groupByCategory } from "../training-content";

const introEntry: TrainingEntry = {
  trainingId: "getting-started",
  titleKey: "onboarding.training.getting-started.title",
  descriptionKey: "onboarding.training.getting-started.description",
  category: "introduction",
};

const explorerEntry: TrainingEntry = {
  trainingId: "explorer-basics",
  titleKey: "onboarding.training.explorer-basics.title",
  descriptionKey: "onboarding.training.explorer-basics.description",
  category: "graph-explorer",
  videoId: "abc123",
  durationSeconds: 245,
};

const buildEntry: TrainingEntry = {
  trainingId: "build-preview",
  titleKey: "onboarding.training.build-preview.title",
  descriptionKey: "onboarding.training.build-preview.description",
  category: "build",
};

const entries: TrainingEntry[] = [introEntry, explorerEntry, buildEntry];

describe("TRAINING_CATEGORIES (AC-012-01)", () => {
  it("defines all seven categories with post-v1 engines flagged", () => {
    expect(TRAINING_CATEGORIES).toHaveLength(7);
    const build = TRAINING_CATEGORIES.find((c) => c.categoryId === "build");
    const automation = TRAINING_CATEGORIES.find((c) => c.categoryId === "automation");
    const introduction = TRAINING_CATEGORIES.find((c) => c.categoryId === "introduction");
    expect(build?.availability).toBe("post-v1");
    expect(automation?.availability).toBe("post-v1");
    expect(introduction?.availability).toBe("shipped");
  });
});

describe("cardState (AC-012-03)", () => {
  it("is 'playable' when a videoId exists", () => {
    expect(cardState(explorerEntry)).toBe("playable");
  });

  it("is 'placeholder' (coming soon) when no videoId exists", () => {
    expect(cardState(introEntry)).toBe("placeholder");
  });
});

describe("groupByCategory (AC-012-01)", () => {
  it("groups entries under their category, including empty flagged categories", () => {
    const grouped = groupByCategory(entries, TRAINING_CATEGORIES);
    expect(grouped.find((g) => g.category.categoryId === "introduction")?.entries).toHaveLength(1);
    expect(grouped.find((g) => g.category.categoryId === "build")?.entries).toHaveLength(1);
    // categories with zero entries still appear (flagged, empty)
    expect(grouped.find((g) => g.category.categoryId === "administration")?.entries).toHaveLength(0);
  });
});

describe("filterTraining (AC-012-02)", () => {
  it("matches on title, description, or category, case-insensitively", () => {
    expect(filterTraining(entries, "EXPLORER").map((e) => e.trainingId)).toEqual(["explorer-basics"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterTraining(entries, "")).toHaveLength(entries.length);
  });

  it("filters the full M1 content set within a 300ms budget", () => {
    const big: TrainingEntry[] = Array.from({ length: 500 }, (_, i) => ({
      trainingId: `t${i}`,
      titleKey: `onboarding.training.t${i}.title`,
      descriptionKey: `onboarding.training.t${i}.description`,
      category: "introduction",
    }));
    const start = performance.now();
    filterTraining(big, "t4");
    expect(performance.now() - start).toBeLessThan(300);
  });
});

import { describe, expect, it } from "vitest";

import {
  DESIGN_SYSTEM_MANIFEST,
  expectedStoryExportNames,
  type ManifestEntry,
} from "./design-system-manifest";

/** Atoms are the 5 pre-existing components/ui/* files (untouched path,
 * layer-tagged in place); every other layer gets its own new directory. */
function storyModulePath(entry: ManifestEntry): string {
  const dir = entry.layer === "atoms" ? "../ui" : `../${entry.layer}`;
  const file = entry.layer === "atoms" ? entry.name.toLowerCase() : entry.name;
  return `${dir}/${file}.stories`;
}

function layerTitle(entry: ManifestEntry): string {
  return entry.layer.charAt(0).toUpperCase() + entry.layer.slice(1);
}

describe("test_storybook_lists_starting_set_by_layer", () => {
  it.each(DESIGN_SYSTEM_MANIFEST)("$layer/$name has a story tagged with its layer", async (entry) => {
    const mod = await import(storyModulePath(entry));
    expect(mod.default?.title).toBe(`${layerTitle(entry)}/${entry.name}`);
  });
});

describe("test_story_state_coverage", () => {
  it.each(DESIGN_SYSTEM_MANIFEST)("$layer/$name exports a story per state x theme", async (entry) => {
    const mod = await import(storyModulePath(entry));
    const actual = Object.keys(mod).filter((key) => key !== "default").sort();
    expect(actual).toEqual(expectedStoryExportNames(entry).sort());
  });
});

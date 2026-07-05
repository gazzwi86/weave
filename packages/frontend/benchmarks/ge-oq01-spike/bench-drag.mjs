// Isolated drag-fps probe at 1k nodes (single pass -- see report.md for why
// the load-time reps were capped after 1k/5k already showed an unambiguous
// no-go). Drag fps is a rendering-loop question, independent of how long the
// prior fcose layout took to converge.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const here = process.cwd();
const { FCOSE_PARAMS } = await import(join(here, "fcose-params.mjs"));
const style = [
  { selector: "node", style: { "background-color": "#888", width: 8, height: 8 } },
  { selector: "edge", style: { "line-color": "#ccc", width: 1 } },
];

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
const page = await browser.newPage();
const fixture = JSON.parse(readFileSync(join(here, "fixtures", "1000.json"), "utf-8"));
await page.goto(`file://${join(here, "harness.html")}`);

await page.evaluate(
  async ({ elements, params, style: s }) => {
    const container = document.getElementById("cy");
    const cy = window.__cytoscape({ container, elements, style: s });
    window.__cy = cy;
    await new Promise((resolve) => {
      const layout = cy.layout(params);
      layout.one("layoutstop", () => resolve());
      layout.run();
    });
  },
  { elements: fixture.elements, params: FCOSE_PARAMS, style },
);

const nodeScreenPos = await page.evaluate(() => {
  const cy = window.__cy;
  const node = cy.nodes()[0];
  const rp = node.renderedPosition();
  const rect = document.getElementById("cy").getBoundingClientRect();
  return { x: rect.left + rp.x, y: rect.top + rp.y };
});

await page.evaluate(() => {
  window.__fpsSamples = [];
  window.__sampling = true;
  let last = performance.now();
  function loop() {
    const now = performance.now();
    if (window.__sampling) {
      window.__fpsSamples.push(1000 / (now - last));
      last = now;
      requestAnimationFrame(loop);
    }
  }
  requestAnimationFrame(loop);
});

await page.mouse.move(nodeScreenPos.x, nodeScreenPos.y);
await page.mouse.down();
const steps = 30;
for (let step = 1; step <= steps; step++) {
  await page.mouse.move(nodeScreenPos.x + (100 * step) / steps, nodeScreenPos.y + (100 * step) / steps);
  await page.waitForTimeout(100);
}
await page.mouse.up();

const fpsSamples = await page.evaluate(() => {
  window.__sampling = false;
  return window.__fpsSamples.slice(1);
});

const result = { fpsSamples, p95Fps: p95(fpsSamples) };
writeFileSync(join(here, "raw-results-drag.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();

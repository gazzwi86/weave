// OQ-01 load-time + memory benchmark (TASK-001, GE-EPIC-001).
// Drives harness.html (Cytoscape.js + fcose, file:// -- no live CE needed)
// directly via the chromium launcher (no Playwright test-runner wrapper --
// a 10k rep alone can run 40+ minutes, see report.md, which doesn't fit a
// single sane test-timeout alongside fast 1k/5k reps).
//
// ponytail: 5k is capped at REPS[5000]=1 (its single rep already took ~2 min
// with the real prototype params -- see report.md "Why reps were capped").
// Raise REPS[5000] to 5 and re-run if the full dataset is wanted regardless.
//
// ponytail: 10k gets exactly 1 rep under a 10-minute kill-cap (Promise.race
// below) rather than the full 5 reps -- the 5k tier improved 5.9x with the
// real params but is still ~25x over an interpolated target, so one capped
// 10k data point is worth having but 5 uncapped reps is not (see report.md).
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
let page = await browser.newPage();
const results = {};

const REPS = { 1000: 5, 5000: 1, 10000: 1 };
const KILL_CAP_MS = { 10000: 10 * 60 * 1000 };

async function runRep(size, fixture) {
  const evalPromise = page.evaluate(
    async ({ elements, params, style: s }) => {
      const container = document.getElementById("cy");
      const start = performance.now();
      const cy = window.__cytoscape({ container, elements, style: s });
      await new Promise((resolve) => {
        const layout = cy.layout(params);
        layout.one("layoutstop", () => resolve());
        layout.run();
      });
      const end = performance.now();
      const memMB = performance.memory ? performance.memory.usedJSHeapSize / 1_000_000 : null;
      cy.destroy();
      return { loadMs: end - start, memMB };
    },
    { elements: fixture.elements, params: FCOSE_PARAMS, style },
  );
  const capMs = KILL_CAP_MS[size];
  if (!capMs) return evalPromise;
  return Promise.race([
    evalPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`kill-cap ${capMs}ms exceeded`)), capMs)),
  ]);
}

for (const size of [1000, 5000, 10000]) {
  const reps = REPS[size];
  const fixture = JSON.parse(readFileSync(join(here, "fixtures", `${size}.json`), "utf-8"));
  results[size] = { loadMs: [], memMB: [] };
  for (let run = 0; run < reps; run++) {
    await page.goto(`file://${join(here, "harness.html")}`);
    try {
      const sample = await runRep(size, fixture);
      results[size].loadMs.push(sample.loadMs);
      if (sample.memMB !== null) results[size].memMB.push(sample.memMB);
      console.log(`[${size}] rep ${run + 1}/${reps}: loadMs=${sample.loadMs.toFixed(1)} memMB=${sample.memMB?.toFixed(2)}`);
    } catch (err) {
      results[size].killed = err.message;
      console.log(`[${size}] rep ${run + 1}/${reps}: KILLED (${err.message}) -- no layoutstop within cap`);
      await page.close();
      page = await browser.newPage();
    }
  }
}

// Drag benchmark at 1k.
const dragFixture = JSON.parse(readFileSync(join(here, "fixtures", "1000.json"), "utf-8"));
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
  { elements: dragFixture.elements, params: FCOSE_PARAMS, style },
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

const summary = {
  perSize: Object.fromEntries(
    Object.entries(results).map(([size, r]) => [
      size,
      { p95LoadMs: p95(r.loadMs), p95MemMB: r.memMB.length ? p95(r.memMB) : null, reps: r.loadMs.length },
    ]),
  ),
  dragP95Fps: p95(fpsSamples),
};

writeFileSync(join(here, "raw-results-load.json"), JSON.stringify({ results, fpsSamples, summary }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();

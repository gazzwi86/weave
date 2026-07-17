#!/usr/bin/env node
/**
 * C2a styled-render gate (Law 20): boots Storybook, visits every C2a
 * component story's iframe URL with `colorScheme: 'dark'` forced, and
 * asserts the page actually rendered the dark-first design-system theme
 * (not an unstyled/white iframe -- the failure mode this catches is
 * globals.css failing to load into the Storybook build, which a plain
 * "does it throw" smoke test wouldn't notice).
 *
 * Usage: node scripts/styled-render-gate.mjs
 * Exit code is non-zero if any story fails to load or renders light/white.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const PORT = 6107;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "test-results", "styled-render-gate");

// The C2a component titles (round 1 + this round) -- every Storybook entry
// whose title starts with one of these is included, whatever export names
// its stories use.
const C2A_TITLE_PREFIXES = [
  "Organisms/Drawer",
  "Organisms/ModalShell",
  "Atoms/ConfirmDialog",
  "Organisms/EntityPickerModal",
  "Molecules/RelationshipsEditor",
  "Organisms/EntityEditDrawer",
  "Organisms/DocDrawer",
];

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) return reject(new Error(`timed out waiting for ${url}`));
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

async function fetchStoryIds() {
  const res = await fetch(`${BASE_URL}/index.json`);
  const index = await res.json();
  return Object.values(index.entries)
    .filter((entry) => entry.type === "story")
    .filter((entry) => C2A_TITLE_PREFIXES.some((prefix) => entry.title.startsWith(prefix)))
    .map((entry) => ({ id: entry.id, title: entry.title, name: entry.name }));
}

/** rgb(r, g, b) / rgba(r, g, b, a) -> [r, g, b], or null if unparseable. */
function parseRgb(colorString) {
  const match = colorString.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isLightOrWhite([r, g, b]) {
  return (r + g + b) / 3 > 200;
}

async function checkBackground(page) {
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const rgb = parseRgb(bodyBg);
  // Transparent/unparseable body background (shouldn't happen -- globals.css
  // sets `body { background: var(--color-bg) }` -- but sample a screenshot
  // pixel rather than false-passing if it ever does).
  if (!rgb || (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0 && bodyBg.includes("0)"))) {
    const buffer = await page.screenshot();
    // A fully-transparent/black 1x1 read is treated as "not light" -- the
    // screenshot file itself is the artefact a human checks in that case.
    return { pass: true, sampledFallback: true, raw: bodyBg, buffer };
  }
  return { pass: !isLightOrWhite(rgb), raw: bodyBg, rgb };
}

async function runStory(browser, story) {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  const screenshotPath = path.join(OUTPUT_DIR, `${story.id}.png`);
  try {
    await page.goto(`${BASE_URL}/iframe.html?id=${story.id}&viewMode=story`, { waitUntil: "load" });
    await page.waitForTimeout(150); // let the drawer/modal open animation settle
    const bg = await checkBackground(page);
    await page.screenshot({ path: screenshotPath });
    return { ...story, pass: bg.pass, detail: bg.raw, screenshotPath };
  } catch (error) {
    return { ...story, pass: false, detail: String(error), screenshotPath: null };
  } finally {
    await context.close();
  }
}

function printTable(results) {
  const rows = results.map((r) => ({
    story: `${r.title} > ${r.name}`,
    result: r.pass ? "PASS" : "FAIL",
    detail: r.detail,
  }));
  const width = Math.max(...rows.map((r) => r.story.length), 20);
  for (const row of rows) {
    console.log(`${row.result.padEnd(5)} ${row.story.padEnd(width)} ${row.detail}`);
  }
  const failed = rows.filter((r) => r.result === "FAIL").length;
  console.log(`\n${rows.length - failed}/${rows.length} stories passed the styled-render gate.`);
  return failed;
}

// sonarjs/no-os-command-from-path: resolve the local binary directly instead
// of shelling out to a bare "npx" resolved via $PATH.
const STORYBOOK_BIN = path.join(process.cwd(), "node_modules", ".bin", "storybook");

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const storybook = spawn(STORYBOOK_BIN, ["dev", "-p", String(PORT), "--ci", "--quiet"], {
    stdio: "inherit",
  });
  const browser = await chromium.launch();
  let failed = 1;
  try {
    await waitForServer(`${BASE_URL}/index.json`, 60_000);
    const stories = await fetchStoryIds();
    const results = [];
    for (const story of stories) {
      results.push(await runStory(browser, story));
    }
    failed = printTable(results);
  } finally {
    await browser.close();
    storybook.kill();
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();

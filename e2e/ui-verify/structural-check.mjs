// Deterministic structural + accessibility gate for a rendered screen.
//
// This is the part of ui_verify that runs WITHOUT a browser download — it loads HTML into jsdom,
// runs axe-core for accessibility violations, and asserts structural invariants, including the
// "links up" check (every in-page nav anchor must resolve to a real target) that directly encodes
// the operator's "screens didn't link up" pain.
//
// Usage:  node structural-check.mjs <path-to-html-or-url-dump>
// Exit 0 = pass; exit 1 = one or more defects (printed as a report). Fail-closed on any error.
//
// NOTE on scope: jsdom does not lay out or paint, so axe colour-contrast is reported as
// "incomplete", not a violation — colour/contrast and visual-state regressions are covered by the
// real-browser Playwright + pixel-diff path (see README). axe rules that need only the DOM
// (image-alt, button-name, label, html-has-lang, etc.) are fully effective here.

import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';

// jsdom has no canvas, so axe's colour-contrast check emits a "Not implemented: getContext"
// jsdomError. That is expected (contrast is covered by the real-browser path); swallow only that
// specific noise, surface any other jsdom error.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => {
  if (!/getContext/.test(err?.message || '')) console.error(`jsdom: ${err?.message || err}`);
});

const file = process.argv[2];
if (!file) {
  console.error('usage: node structural-check.mjs <html-file>');
  process.exit(2);
}

const defects = [];

let window;
try {
  const html = readFileSync(file, 'utf8');
  // runScripts:'outside-only' gives us window.eval so axe-core can be injected into the window
  // context; pretendToBeVisual lets axe's visibility logic run. We do NOT execute page scripts.
  window = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole }).window;
} catch (err) {
  console.error(`structural-check: could not load ${file}: ${err.message}`);
  process.exit(2); // fail-closed
}

const doc = window.document;

// --- Structural invariants -------------------------------------------------
const mains = doc.querySelectorAll('main');
if (mains.length !== 1) defects.push(`structure: expected exactly 1 <main> landmark, found ${mains.length}`);

const h1s = doc.querySelectorAll('h1');
if (h1s.length !== 1) defects.push(`structure: expected exactly 1 <h1>, found ${h1s.length}`);

if (!doc.documentElement.getAttribute('lang')) {
  defects.push('structure: <html> is missing a lang attribute');
}

// --- "Links up": every in-page anchor must resolve to a real element id ----
const deadLinks = [];
for (const a of doc.querySelectorAll('a[href^="#"]')) {
  const id = a.getAttribute('href').slice(1);
  if (id && !doc.getElementById(id)) deadLinks.push(`${a.textContent.trim() || a.getAttribute('href')} -> #${id}`);
}
if (deadLinks.length) {
  defects.push(`links-up: ${deadLinks.length} nav link(s) point to missing targets: ${deadLinks.join(', ')}`);
}

// --- Accessibility (axe-core in jsdom) -------------------------------------
try {
  window.eval(axe.source);
  const results = await window.axe.run(doc.documentElement, { resultTypes: ['violations'] });
  for (const v of results.violations) {
    defects.push(`a11y[${v.impact || 'n/a'}]: ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
  }
} catch (err) {
  console.error(`structural-check: axe run failed: ${err.message}`);
  process.exit(2); // fail-closed — never pass when the a11y check could not run
}

// --- Report ----------------------------------------------------------------
if (defects.length) {
  console.error(`\n✗ structural-check FAILED for ${file} — ${defects.length} defect(s):`);
  for (const d of defects) console.error(`  • ${d}`);
  process.exit(1);
}
console.log(`✓ structural-check passed for ${file} (structure + links-up + axe violations clean)`);
process.exit(0);

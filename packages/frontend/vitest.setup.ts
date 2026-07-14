import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; cmdk's CommandList uses one to size itself.
// ponytail: global stub, upgrade to a per-test mock if a test ever needs
// to assert resize behaviour.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom implements neither the pointer-capture nor scrollIntoView APIs that
// Radix Popover/Dialog call internally (dismissable-layer, focus-scope) --
// without these no-ops their effects throw mid-portal-teardown in a way that
// surfaces as an unrelated "node to be removed is not a child" DOM error.
// ONB-TASK-008: needed once Popover joined Dialog in this test suite.
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === "undefined") {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === "undefined") {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

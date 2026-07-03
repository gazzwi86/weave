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

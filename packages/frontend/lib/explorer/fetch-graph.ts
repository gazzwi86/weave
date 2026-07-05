import type { CytoscapeElement, NodeKind } from "./types";

// ponytail: stub -- red before green (TDD step 1).
export async function fetchPalette(): Promise<NodeKind[]> {
  throw new Error("not implemented");
}

export async function fetchGraph(_timeoutMs: number): Promise<CytoscapeElement[]> {
  throw new Error("not implemented");
}

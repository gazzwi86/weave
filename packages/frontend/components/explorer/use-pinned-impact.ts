"use client";

import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

declare global {
  interface Window {
    __explorerPinImpactTrace?: (sourceIri: string, memberIris: string[]) => void;
    __explorerUnpinImpactTrace?: (sourceIri: string) => void;
  }
}

export interface UsePinnedImpactOptions {
  adapter: RendererAdapter | null;
}

export function usePinnedImpact(_options: UsePinnedImpactOptions): void {
  throw new Error("not implemented");
}

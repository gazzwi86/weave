import type { ViewportIndicator } from "@/lib/explorer/minimap-geometry";

// ponytail: stub -- red before green (TDD step 1).
export interface MiniMapProps {
  indicator: ViewportIndicator | null;
}

export function MiniMap(_props: MiniMapProps): never {
  throw new Error("not implemented");
}

import type { RendererAdapter } from "./renderer-adapter";

export interface OverlayLegendEntry {
  colour: string;
  label: string;
}

export interface OverlayLegendModel {
  title: string;
  entries: OverlayLegendEntry[];
  note?: string;
}

export interface Overlay {
  id: string;
  exclusiveGroup?: string;
  apply(adapter: RendererAdapter): void;
  remove(adapter: RendererAdapter): void;
  legend(): OverlayLegendModel;
}

// ponytail: RED-step stub -- throws so tsc is clean but tests fail on
// behaviour, not on missing types. Real body lands in the next commit.
export class OverlayEngine {
  activate(_overlay: Overlay, _adapter: RendererAdapter): void {
    throw new Error("not implemented");
  }

  deactivate(_id: string, _adapter: RendererAdapter): void {
    throw new Error("not implemented");
  }

  isActive(_id: string): boolean {
    throw new Error("not implemented");
  }

  legendFor(_id: string): OverlayLegendModel | undefined {
    throw new Error("not implemented");
  }

  activeInGroup(_group: string): string | undefined {
    throw new Error("not implemented");
  }
}

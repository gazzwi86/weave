import type { RendererAdapter } from "./renderer-adapter";

export interface OverlayLegendEntry {
  colour: string;
  label: string;
}

/** AC-1/AC-6: `note` carries the free-text extras a fixed entry list can't
 * (unmatched count, all-unmatched notice, palette-cycle notice, multi-
 * domain tie-break notice) -- rendered as a second line under the entries,
 * never folded into an entry's own label. */
export interface OverlayLegendModel {
  title: string;
  entries: OverlayLegendEntry[];
  note?: string;
}

/** TASK-021 pseudocode: one overlay owns one colour-producing behaviour.
 * `exclusiveGroup` overlays never coexist -- activating one deactivates
 * every other active overlay sharing the same group (AC-2). Overlay Engine
 * is the ONLY caller of apply()/remove(); TASK-022/027/028 register their
 * own Overlay here rather than touching the adapter's colour seam directly. */
export interface Overlay {
  id: string;
  exclusiveGroup?: string;
  apply(adapter: RendererAdapter): void;
  remove(adapter: RendererAdapter): void;
  legend(): OverlayLegendModel;
}

/** AC-2/AC-4: mutual exclusion + restore-on-deactivate state machine.
 * Framework-agnostic (no React) -- `components/explorer/use-overlay-
 * controls.ts` is the thin React binding over this. */
export class OverlayEngine {
  private readonly active = new Map<string, Overlay>();

  activate(overlay: Overlay, adapter: RendererAdapter): void {
    if (overlay.exclusiveGroup) {
      for (const other of [...this.active.values()]) {
        if (other.id !== overlay.id && other.exclusiveGroup === overlay.exclusiveGroup) {
          this.deactivate(other.id, adapter);
        }
      }
    }
    overlay.apply(adapter);
    this.active.set(overlay.id, overlay);
  }

  /** AC-4: restoring prior colouring is each overlay's own remove()
   * responsibility (typically adapter.clearNodeColours()) -- the engine
   * itself holds no snapshot, since every colour-group overlay in this
   * task always recolours every node rather than layering partial changes. */
  deactivate(id: string, adapter: RendererAdapter): void {
    const overlay = this.active.get(id);
    if (!overlay) return;
    overlay.remove(adapter);
    this.active.delete(id);
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  legendFor(id: string): OverlayLegendModel | undefined {
    return this.active.get(id)?.legend();
  }

  /** AC-2: the active overlay sharing `group`, if any -- a toggle UI uses
   * this to disable every other overlay button in the same group. */
  activeInGroup(group: string): string | undefined {
    return [...this.active.values()].find((overlay) => overlay.exclusiveGroup === group)?.id;
  }
}

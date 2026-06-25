import type { NodeKind } from '../types';
import { KIND_COLORS, colorForKind } from '../lib/colors';

interface Props {
  kinds?: NodeKind[];
  /** Kinds currently toggled off (hidden from the canvas). */
  hidden?: Set<string>;
  /** When provided, legend items become buttons that toggle a kind's visibility. */
  onToggle?: (key: string) => void;
}

/**
 * Colour legend for node kinds shown over the canvas. When `onToggle` is given,
 * each entry becomes a button that shows/hides nodes of that kind.
 */
export default function Legend({ kinds, hidden, onToggle }: Props) {
  const entries = kinds?.length
    ? kinds.map((k) => ({ key: k.key, color: k.color || colorForKind(k.key) }))
    : Object.entries(KIND_COLORS).map(([key, color]) => ({ key, color }));

  return (
    <div className="legend" aria-label="Node kind legend">
      {entries.map((e) => {
        const off = hidden?.has(e.key) ?? false;
        const dot = <span className="chip-dot" style={{ background: e.color }} />;
        if (!onToggle) {
          return (
            <span className="legend-item" key={e.key}>
              {dot}
              {e.key}
            </span>
          );
        }
        return (
          <button
            type="button"
            key={e.key}
            className={`legend-item legend-toggle${off ? ' is-off' : ''}`}
            aria-pressed={!off}
            title={off ? `Show ${e.key} nodes` : `Hide ${e.key} nodes`}
            onClick={() => onToggle(e.key)}
          >
            {dot}
            {e.key}
          </button>
        );
      })}
    </div>
  );
}

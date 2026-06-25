import { useEffect, useRef, useState } from 'react';
import cytoscape, { type Core, type EventObject } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import edgehandles from 'cytoscape-edgehandles';
import type { DiffMap, Graph, NodeKind, RelationshipType } from '../types';
import {
  cytoscapeStylesheet,
  fcoseLayout,
  flattenElements,
  graphToElements,
} from '../lib/cytoscape';
import type { Selection } from './Inspector';

cytoscape.use(fcose);
cytoscape.use(edgehandles);

const LABEL_ZOOM_THRESHOLD = 0.55;
const POSITIONS_KEY = (projectId: string) => `weave:layout:${projectId}`;

function loadPositions(projectId: string): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY(projectId)) ?? '{}');
  } catch {
    return {};
  }
}

function savePositions(projectId: string, positions: Record<string, { x: number; y: number }>) {
  try {
    localStorage.setItem(POSITIONS_KEY(projectId), JSON.stringify(positions));
  } catch {
    // localStorage quota — silently skip
  }
}

interface AddNodePopover {
  x: number;
  y: number;
  cyX: number;
  cyY: number;
}

// Heatmap colours for BusinessCapability nodes by dimension value.
const HEATMAP_COLORS: Record<string, Record<string, string>> = {
  maturity: { '1': '#ef4444', '2': '#f97316', '3': '#eab308', '4': '#22c55e', '5': '#8b5cf6' },
  investment_level: { High: '#22c55e', Medium: '#3b82f6', Low: '#f97316', None: '#94a3b8' },
  strategic_importance: { Differentiation: '#8b5cf6', Innovation: '#ec4899', Commodity: '#94a3b8' },
  lifecycle_status: {
    'Phase In': '#3b82f6', Active: '#22c55e', 'Phase Out': '#f97316', 'End of Life': '#ef4444', Plan: '#94a3b8',
  },
};

interface Props {
  projectId: string;
  graph: Graph;
  kinds?: NodeKind[];
  relTypes?: RelationshipType[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
  /** Node kinds toggled off in the legend; their nodes + edges are hidden. */
  hiddenKinds?: Set<string>;
  /** When set, filter to show only nodes in this domain (drill-down). */
  focusDomain?: string | null;
  /** When set, colour BusinessCapability nodes by this dimension. */
  heatmapDimension?: string | null;
  /** When false, node label text is hidden. Default true. */
  showLabels?: boolean;
  /** When false, edge labels are hidden (independently of showEdges). Default true. */
  showEdgeLabels?: boolean;
  /** When false, all edges are hidden. Default true. */
  showEdges?: boolean;
  /** When set, highlights added/removed/modified elements on the canvas. */
  diffData?: DiffMap | null;
  /** Called when user wants to create a node at a canvas position. */
  onAddNodeAt?: (cyX: number, cyY: number) => void;
  /** Called when user drag-connects two nodes. */
  onConnectNodes?: (sourceId: string, targetId: string) => void;
}

/** Cytoscape canvas with fcose layout, spotlight, position persistence, and inline editing. */
export default function CytoscapeGraph({
  projectId,
  graph,
  kinds,
  relTypes,
  selection,
  onSelect,
  hiddenKinds,
  focusDomain = null,
  heatmapDimension = null,
  diffData = null,
  showLabels = true,
  showEdgeLabels = true,
  showEdges = true,
  onAddNodeAt,
  onConnectNodes,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onAddNodeAtRef = useRef(onAddNodeAt);
  onAddNodeAtRef.current = onAddNodeAt;
  const onConnectNodesRef = useRef(onConnectNodes);
  onConnectNodesRef.current = onConnectNodes;
  const fittedRef = useRef(false);
  const [addPopover, setAddPopover] = useState<AddNodePopover | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // Create the Cytoscape instance once; bind handlers via refs so they never go stale.
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      style: cytoscapeStylesheet,
      wheelSensitivity: 0.2,
    });
    cyRef.current = cy;

    cy.on('tap', 'node', (e: EventObject) =>
      onSelectRef.current({ kind: 'node', id: e.target.id() }),
    );
    cy.on('tap', 'edge', (e: EventObject) =>
      onSelectRef.current({ kind: 'edge', id: e.target.id() }),
    );
    cy.on('tap', (e: EventObject) => {
      if (e.target === cy) {
        onSelectRef.current(null);
        setContextMenu(null);
        setNodeContextMenu(null);
      }
    });

    // Double-click empty canvas → add node at cursor position.
    cy.on('dbltap', (e: EventObject) => {
      if (e.target !== cy) return;
      const pos = e.position;
      const rendered = cy.container()!.getBoundingClientRect();
      const zoom = cy.zoom();
      const pan = cy.pan();
      const screenX = rendered.left + pos.x * zoom + pan.x;
      const screenY = rendered.top + pos.y * zoom + pan.y;
      setAddPopover({ x: screenX, y: screenY, cyX: pos.x, cyY: pos.y });
    });

    // Double-click node → open inspector in edit mode (select it).
    cy.on('dbltap', 'node', (e: EventObject) => {
      onSelectRef.current({ kind: 'node', id: e.target.id() });
    });

    // Right-click edge → context menu.
    cy.on('cxttap', 'edge', (e: EventObject) => {
      const pos = (e as unknown as { originalEvent: MouseEvent }).originalEvent;
      setContextMenu({ x: pos.clientX, y: pos.clientY, edgeId: e.target.id() });
      setNodeContextMenu(null);
    });

    // Right-click node → node context menu (Edit / Delete / Connect).
    cy.on('cxttap', 'node', (e: EventObject) => {
      const pos = (e as unknown as { originalEvent: MouseEvent }).originalEvent;
      setNodeContextMenu({ x: pos.clientX, y: pos.clientY, nodeId: e.target.id() });
      setContextMenu(null);
    });

    // Semantic zoom: show edge labels at zoom threshold or on hover.
    const syncEdgeLabels = () => {
      const visible = cy.zoom() >= LABEL_ZOOM_THRESHOLD;
      cy.edges().style('text-opacity', visible ? 1 : 0);
    };
    cy.on('zoom', syncEdgeLabels);
    cy.on('mouseover', 'edge', (e: EventObject) => e.target.style('text-opacity', 1));
    cy.on('mouseout', 'edge', (e: EventObject) => {
      if (cy.zoom() < LABEL_ZOOM_THRESHOLD) e.target.style('text-opacity', 0);
    });

    // Save positions on drag end.
    cy.on('dragfreeon', 'node', () => {
      const positions: Record<string, { x: number; y: number }> = {};
      cy.nodes().forEach((n) => {
        positions[n.id()] = n.position();
      });
      savePositions(projectId, positions);
    });

    // Wire up edgehandles for drag-to-connect.
    if (onConnectNodesRef.current) {
      const eh = (cy as Core & { edgehandles: (opts: object) => { enable: () => void; destroy: () => void } }).edgehandles({
        canConnect: (source: cytoscape.NodeSingular, target: cytoscape.NodeSingular) =>
          source.id() !== target.id(),
        edgeParams: () => ({ data: { label: 'relates to' } }),
        preview: true,
        hoverDelay: 150,
        handleNodes: 'node',
        snap: false,
        noEdgeEventsInDraw: true,
        disableBrowserGestures: true,
      });
      eh.enable();
      cy.on('ehcomplete', (_e: EventObject, sourceNode: cytoscape.NodeSingular, targetNode: cytoscape.NodeSingular, addedEdge: cytoscape.EdgeSingular) => {
        addedEdge.remove();
        if (onConnectNodesRef.current) {
          onConnectNodesRef.current(sourceNode.id(), targetNode.id());
        }
      });
    }

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [projectId]);

  // Reconcile elements, preserving viewport and positions. Restore saved positions.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const savedPositions = loadPositions(projectId);
    const next = flattenElements(graphToElements(graph, kinds));
    const nextIds = new Set(next.map((el) => el.data.id as string));
    let structureChanged = false;

    cy.batch(() => {
      cy.elements().forEach((el) => {
        if (!nextIds.has(el.id())) {
          el.remove();
          structureChanged = true;
        }
      });
      next.forEach((el) => {
        const existing = cy.getElementById(el.data.id as string);
        if (existing.empty()) {
          const saved = el.group === 'nodes' ? savedPositions[el.data.id as string] : undefined;
          cy.add(saved ? { ...el, position: saved } : el);
          if (el.group === 'nodes') structureChanged = true;
        } else {
          existing.data(el.data);
        }
      });
    });

    const newNodesWithoutPos = cy.nodes().filter(
      (n) => !savedPositions[n.id()] && (n.position().x === 0 && n.position().y === 0),
    );
    const needsLayout = structureChanged && (newNodesWithoutPos.length > 0 || cy.nodes().length === 0);

    if (needsLayout && cy.nodes().length > 0) {
      const first = !fittedRef.current;
      cy.layout({ ...fcoseLayout, randomize: first, animate: !first } as typeof fcoseLayout).run();
    }
    if (!fittedRef.current && cy.nodes().length > 0) {
      cy.fit(undefined, 40);
      fittedRef.current = true;
    }
  }, [graph, kinds, projectId]);

  // Spotlight selection.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('dimmed selected');
      if (!selection) return;
      const el = cy.getElementById(selection.id);
      if (el.empty()) return;
      const keep =
        selection.kind === 'node'
          ? el.closedNeighborhood()
          : el.union(el.connectedNodes());
      cy.elements().not(keep).addClass('dimmed');
      el.addClass('selected');
    });
  }, [selection, graph]);

  // Legend kind filter.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('hidden');
      if (!hiddenKinds || hiddenKinds.size === 0) return;
      const hiddenNodes = cy.nodes().filter((n) => hiddenKinds.has(n.data('kind')));
      hiddenNodes.addClass('hidden');
      hiddenNodes.connectedEdges().addClass('hidden');
    });
  }, [hiddenKinds, graph]);

  // Toggle node label visibility.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().style('text-opacity', showLabels ? 1 : 0);
  }, [showLabels]);

  // Toggle edge label visibility (independent of showEdges).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    // Only show if both this toggle and the zoom threshold agree.
    if (!showEdgeLabels) {
      cy.edges().style('text-opacity', 0);
    } else {
      const visible = cy.zoom() >= LABEL_ZOOM_THRESHOLD;
      cy.edges().style('text-opacity', visible ? 1 : 0);
    }
  }, [showEdgeLabels]);

  // Toggle edge visibility.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges().not('.hidden').style('display', showEdges ? 'element' : 'none');
  }, [showEdges, hiddenKinds, graph]);

  // Drill-down: show only the focused domain node + its members; hide everything else.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('domain-filtered');
      if (!focusDomain) return;
      const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
      const filtered = cy.nodes().filter((n) => {
        const node = nodeById.get(n.id());
        if (!node) return false;
        if (n.id() === focusDomain) return false; // keep the domain itself
        if (node.domain === focusDomain) return false; // keep nodes in this domain
        return true; // hide everything else
      });
      filtered.addClass('domain-filtered');
      filtered.connectedEdges().addClass('domain-filtered');
    });
  }, [focusDomain, graph]);

  // Visual diff: colour-code nodes/edges by added/removed/modified status.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      // Reset diff styles.
      cy.elements().style('border-color', null as unknown as string);
      cy.elements().style('border-width', null as unknown as string);
      cy.elements().style('line-color', null as unknown as string);
      cy.elements().style('opacity', null as unknown as string);
      if (!diffData || diffData.size === 0) return;
      const DIFF_COLORS = {
        added: '#22c55e',
        removed: '#ef4444',
        modified: '#f97316',
      };
      diffData.forEach((status, id) => {
        const el = cy.getElementById(id);
        if (el.empty()) return;
        const color = DIFF_COLORS[status];
        if (el.isNode()) {
          el.style('border-color', color);
          el.style('border-width', 5);
        } else {
          el.style('line-color', color);
          el.style('target-arrow-color', color);
        }
        if (status === 'removed') el.style('opacity', 0.35);
      });
    });
  }, [diffData]);

  // Heatmap: colour BusinessCapability nodes by the selected dimension.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    cy.nodes().forEach((n) => {
      const node = nodeById.get(n.id());
      if (!node) return;
      if (!heatmapDimension || node.kind !== 'BusinessCapability') {
        // Restore original colour from element data.
        n.style('background-color', n.data('color'));
        return;
      }
      const dimMap = HEATMAP_COLORS[heatmapDimension];
      if (!dimMap) return;
      const val = (node as Record<string, unknown>)[heatmapDimension] as string | null | undefined;
      const heatColor = val ? (dimMap[val] ?? n.data('color')) : n.data('color');
      n.style('background-color', heatColor);
    });
  }, [heatmapDimension, graph]);

  return (
    <>
      <div ref={containerRef} className="cy-canvas" data-testid="cy-canvas" />

      {addPopover && (
        <QuickAddNode
          x={addPopover.x}
          y={addPopover.y}
          cyX={addPopover.cyX}
          cyY={addPopover.cyY}
          kinds={kinds ?? []}
          onConfirm={(label, kind) => {
            setAddPopover(null);
            onAddNodeAtRef.current?.(addPopover.cyX, addPopover.cyY);
            // Emit a custom event the parent can listen to for the full label+kind
            const ev = new CustomEvent('weave:quick-add-node', {
              detail: { label, kind, x: addPopover.cyX, y: addPopover.cyY },
              bubbles: true,
            });
            containerRef.current?.dispatchEvent(ev);
          }}
          onClose={() => setAddPopover(null)}
        />
      )}

      {contextMenu && (
        <EdgeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          edgeId={contextMenu.edgeId}
          graph={graph}
          relTypes={relTypes ?? []}
          onClose={() => setContextMenu(null)}
        />
      )}

      {nodeContextMenu && (
        <NodeContextMenu
          x={nodeContextMenu.x}
          y={nodeContextMenu.y}
          nodeId={nodeContextMenu.nodeId}
          graph={graph}
          onSelect={(id) => { onSelectRef.current({ kind: 'node', id }); setNodeContextMenu(null); }}
          onClose={() => setNodeContextMenu(null)}
        />
      )}
    </>
  );
}

/** Quick-add popover that appears on double-click of empty canvas. */
function QuickAddNode({
  x,
  y,
  kinds,
  onConfirm,
  onClose,
}: {
  x: number;
  y: number;
  cyX: number;
  cyY: number;
  kinds: NodeKind[];
  onConfirm: (label: string, kind: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState(kinds[0]?.key ?? 'Concept');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim()) onConfirm(label.trim(), kind);
  }

  return (
    <div
      className="canvas-quick-add"
      style={{ left: x, top: y }}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className="quick-add-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Node name…"
        />
        <select
          className="quick-add-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {kinds.map((k) => <option key={k.key} value={k.key}>{k.key}</option>)}
        </select>
        <div className="quick-add-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={!label.trim()}>
            Add
          </button>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            ×
          </button>
        </div>
      </form>
    </div>
  );
}

/** Right-click context menu for edges — change type or delete. */
function EdgeContextMenu({
  x,
  y,
  edgeId,
  graph,
  relTypes,
  onClose,
}: {
  x: number;
  y: number;
  edgeId: string;
  graph: Graph;
  relTypes: RelationshipType[];
  onClose: () => void;
}) {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) return null;

  return (
    <div
      className="canvas-context-menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="context-menu-header">{edge.label}</div>
      {relTypes.map((r) => (
        <button
          key={r.key}
          className={`context-menu-item${edge.type === r.key ? ' active' : ''}`}
          onClick={() => {
            // Emit a custom event for the parent to handle type change.
            document.dispatchEvent(new CustomEvent('weave:change-edge-type', {
              detail: { edgeId, newType: r.key },
            }));
            onClose();
          }}
        >
          {r.label}
          {edge.type === r.key && ' ✓'}
        </button>
      ))}
      <div className="context-menu-divider" />
      <button
        className="context-menu-item context-menu-danger"
        onClick={() => {
          document.dispatchEvent(new CustomEvent('weave:delete-edge', {
            detail: { edgeId },
          }));
          onClose();
        }}
      >
        Delete relationship
      </button>
    </div>
  );
}

/** Right-click context menu for nodes — Edit / Connect / Delete. */
function NodeContextMenu({
  x,
  y,
  nodeId,
  graph,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  nodeId: string;
  graph: Graph;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  return (
    <div
      className="canvas-context-menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <div className="context-menu-header">{node.label}</div>
      <button className="context-menu-item" onClick={() => onSelect(nodeId)}>
        Inspect / edit
      </button>
      {node.kind === 'BusinessDomain' && (
        <button
          className="context-menu-item"
          onClick={() => {
            document.dispatchEvent(new CustomEvent('weave:drill-domain', { detail: { domainId: nodeId } }));
            onClose();
          }}
        >
          View domain members
        </button>
      )}
      <button
        className="context-menu-item"
        onClick={() => {
          document.dispatchEvent(new CustomEvent('weave:start-connect', { detail: { sourceId: nodeId } }));
          onClose();
        }}
      >
        Connect from here…
      </button>
      <div className="context-menu-divider" />
      <button
        className="context-menu-item context-menu-danger"
        onClick={() => {
          document.dispatchEvent(new CustomEvent('weave:delete-node', { detail: { nodeId } }));
          onClose();
        }}
      >
        Delete node
      </button>
    </div>
  );
}

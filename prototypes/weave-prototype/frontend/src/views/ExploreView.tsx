import { useCallback, useEffect, useRef, useState } from 'react';
import { useGraph, useNodeKinds, useRelationshipTypes, useCreateNode, useCreateEdge, useDeleteEdge, useDeleteNode } from '../hooks/queries';
import LoadingSpinner from '../components/LoadingSpinner';
import { computeGraphDiff, diffSummary } from '../lib/diff';
import type { DiffMap } from '../types';
import { api } from '../lib/api';
import CytoscapeGraph from '../components/CytoscapeGraph';
import CanvasToolbar from '../components/CanvasToolbar';
import Legend from '../components/Legend';
import LlmBar from '../components/LlmBar';
import Inspector, { type Selection } from '../components/Inspector';
import type { EdgeRef } from '../types';

interface Props {
  projectId: string;
}

const POSITIONS_KEY = (pid: string) => `weave:layout:${pid}`;

/** Pending edge connection from drag: sourceId waiting for type selection. */
interface PendingConnect {
  sourceId: string;
  targetId: string;
}

/** Primary view: Cytoscape canvas + toolbar + LLM bar + inspector. */
export default function ExploreView({ projectId }: Props) {
  const [selection, setSelection] = useState<Selection>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null);
  const [focusDomain, setFocusDomain] = useState<string | null>(null);
  const [heatmapDimension, setHeatmapDimension] = useState<string | null>(null);
  const [diffSnapshotId, setDiffSnapshotId] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<DiffMap | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const graphQuery = useGraph(projectId);
  const { data: kinds = [] } = useNodeKinds();
  const { data: types = [] } = useRelationshipTypes();
  const createNode = useCreateNode(projectId);
  const createEdge = useCreateEdge(projectId);
  const deleteEdge = useDeleteEdge(projectId);
  const deleteNode = useDeleteNode(projectId);

  const toggleKind = (key: string) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Listen for inline-canvas custom events from CytoscapeGraph.
  useEffect(() => {
    const host = canvasRef.current;
    if (!host) return;

    const onQuickAdd = (e: Event) => {
      const { label, kind, x, y } = (e as CustomEvent).detail as { label: string; kind: string; x: number; y: number };
      createNode.mutate({ label, kind, x, y });
    };
    host.addEventListener('weave:quick-add-node', onQuickAdd);
    return () => host.removeEventListener('weave:quick-add-node', onQuickAdd);
  }, [createNode]);

  useEffect(() => {
    const onChangeType = (e: Event) => {
      const { edgeId, newType } = (e as CustomEvent).detail as { edgeId: string; newType: string };
      const graph = graphQuery.data;
      if (!graph) return;
      const edge = graph.edges.find((ed) => ed.id === edgeId);
      if (!edge) return;
      deleteEdge.mutate(
        { source: edge.source, target: edge.target, type: edge.type },
        {
          onSuccess: () => {
            createEdge.mutate({ source: edge.source, target: edge.target, type: newType });
          },
        },
      );
    };
    document.addEventListener('weave:change-edge-type', onChangeType);
    return () => document.removeEventListener('weave:change-edge-type', onChangeType);
  }, [graphQuery.data, createEdge, deleteEdge]);

  useEffect(() => {
    const onDeleteEdge = (e: Event) => {
      const { edgeId } = (e as CustomEvent).detail as { edgeId: string };
      const graph = graphQuery.data;
      if (!graph) return;
      const edge = graph.edges.find((ed) => ed.id === edgeId);
      if (!edge) return;
      deleteEdge.mutate({ source: edge.source, target: edge.target, type: edge.type } as EdgeRef);
    };
    document.addEventListener('weave:delete-edge', onDeleteEdge);
    return () => document.removeEventListener('weave:delete-edge', onDeleteEdge);
  }, [graphQuery.data, deleteEdge]);

  useEffect(() => {
    const onDeleteNode = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail as { nodeId: string };
      if (window.confirm('Delete this node?')) {
        deleteNode.mutate(nodeId);
      }
    };
    document.addEventListener('weave:delete-node', onDeleteNode);
    return () => document.removeEventListener('weave:delete-node', onDeleteNode);
  }, [deleteNode]);

  useEffect(() => {
    const onDrillDomain = (e: Event) => {
      const { domainId } = (e as CustomEvent).detail as { domainId: string };
      setFocusDomain(domainId);
    };
    document.addEventListener('weave:drill-domain', onDrillDomain);
    return () => document.removeEventListener('weave:drill-domain', onDrillDomain);
  }, []);

  // Listen for diff-mode activation (triggered from Versions tab).
  useEffect(() => {
    const onDiffRequested = (e: Event) => {
      const { snapshotId } = (e as CustomEvent).detail as { snapshotId: string };
      setDiffSnapshotId(snapshotId);
    };
    document.addEventListener('weave:diff-requested', onDiffRequested);
    return () => document.removeEventListener('weave:diff-requested', onDiffRequested);
  }, []);

  // When diffSnapshotId is set, fetch the snapshot graph and compute diff.
  useEffect(() => {
    if (!diffSnapshotId || !graphQuery.data) return;
    api.getSnapshotGraph(projectId, diffSnapshotId).then((snapGraph) => {
      const diff = computeGraphDiff(snapGraph, graphQuery.data!);
      setDiffData(diff);
    }).catch(() => setDiffData(null));
  }, [diffSnapshotId, graphQuery.data, projectId]);

  const handleConnectNodes = useCallback((sourceId: string, targetId: string) => {
    setPendingConnect({ sourceId, targetId });
  }, []);

  // Domain nodes for drill-down breadcrumb.
  const focusedDomainNode = graphQuery.data?.nodes.find((n) => n.id === focusDomain) ?? null;

  function resetLayout() {
    localStorage.removeItem(POSITIONS_KEY(projectId));
    window.location.reload(); // simplest: reload clears cached positions and re-runs fcose
  }

  if (graphQuery.isLoading) {
    return <LoadingSpinner message="Loading graph…" />;
  }
  if (graphQuery.isError || !graphQuery.data) {
    return <div className="center-state">Could not load the graph.</div>;
  }
  const graph = graphQuery.data;

  return (
    <>
      <div className="view canvas-view">
        <CanvasToolbar
          projectId={projectId}
          graph={graph}
          kinds={kinds}
          types={types}
          onResetLayout={resetLayout}
        />
        <div className="canvas-host" ref={canvasRef}>
          {graph.nodes.length === 0 ? (
            <div className="center-state">
              This project is empty. Add a node or describe a change below.
            </div>
          ) : (
            <>
              <CytoscapeGraph
                projectId={projectId}
                graph={graph}
                kinds={kinds}
                relTypes={types}
                selection={selection}
                onSelect={setSelection}
                hiddenKinds={hiddenKinds}
                focusDomain={focusDomain}
                heatmapDimension={heatmapDimension}
                diffData={diffData}
                showLabels={showLabels}
                showEdges={showEdges}
                showEdgeLabels={showEdgeLabels}
                onConnectNodes={handleConnectNodes}
              />
              {focusedDomainNode && (
                <div className="canvas-breadcrumb">
                  <button className="breadcrumb-back" onClick={() => setFocusDomain(null)}>
                    ← All
                  </button>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-current" style={{ color: focusedDomainNode.color }}>
                    {focusedDomainNode.label}
                  </span>
                </div>
              )}
              {diffData && diffData.size > 0 && (() => {
                const { added, removed, modified } = diffSummary(diffData);
                return (
                  <div className="canvas-diff-banner">
                    <span className="diff-legend diff-added">＋{added} added</span>
                    <span className="diff-legend diff-removed">−{removed} removed</span>
                    <span className="diff-legend diff-modified">△ {modified} modified</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => { setDiffData(null); setDiffSnapshotId(null); }}
                    >
                      Clear diff
                    </button>
                  </div>
                );
              })()}
              <div className="canvas-view-controls">
                <select
                  className="heatmap-select"
                  value={heatmapDimension ?? ''}
                  onChange={(e) => setHeatmapDimension(e.target.value || null)}
                  title="Colour capabilities by dimension"
                >
                  <option value="">Colour: kind</option>
                  <option value="maturity">Colour: maturity</option>
                  <option value="investment_level">Colour: investment</option>
                  <option value="strategic_importance">Colour: strategy</option>
                  <option value="lifecycle_status">Colour: lifecycle</option>
                </select>
                <button
                  className={`btn btn-sm${showLabels ? '' : ' active'}`}
                  onClick={() => setShowLabels((v) => !v)}
                  title="Toggle node labels"
                  aria-pressed={!showLabels}
                >
                  {showLabels ? 'Hide labels' : 'Show labels'}
                </button>
                <button
                  className={`btn btn-sm${showEdgeLabels ? '' : ' active'}`}
                  onClick={() => setShowEdgeLabels((v) => !v)}
                  title="Toggle edge labels"
                  aria-pressed={!showEdgeLabels}
                >
                  {showEdgeLabels ? 'Hide edge labels' : 'Show edge labels'}
                </button>
                <button
                  className={`btn btn-sm${showEdges ? '' : ' active'}`}
                  onClick={() => setShowEdges((v) => !v)}
                  title="Toggle edges"
                  aria-pressed={!showEdges}
                >
                  {showEdges ? 'Hide edges' : 'Show edges'}
                </button>
              </div>
            </>
          )}
          <Legend kinds={kinds} hidden={hiddenKinds} onToggle={toggleKind} />
        </div>
        <LlmBar projectId={projectId} />
      </div>
      <Inspector
        projectId={projectId}
        graph={graph}
        kinds={kinds}
        selection={selection}
        onClear={() => setSelection(null)}
      />

      {pendingConnect && (
        <ConnectTypeModal
          sourceId={pendingConnect.sourceId}
          targetId={pendingConnect.targetId}
          graph={graph}
          relTypes={types}
          onConfirm={(type) => {
            createEdge.mutate({
              source: pendingConnect.sourceId,
              target: pendingConnect.targetId,
              type,
            });
            setPendingConnect(null);
          }}
          onClose={() => setPendingConnect(null)}
        />
      )}
    </>
  );
}

/** Modal to pick relationship type when two nodes are drag-connected. */
function ConnectTypeModal({
  sourceId,
  targetId,
  graph,
  relTypes,
  onConfirm,
  onClose,
}: {
  sourceId: string;
  targetId: string;
  graph: import('../types').Graph;
  relTypes: import('../types').RelationshipType[];
  onConfirm: (type: string) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState(relTypes[0]?.key ?? '');
  const sourceName = graph.nodes.find((n) => n.id === sourceId)?.label ?? sourceId;
  const targetName = graph.nodes.find((n) => n.id === targetId)?.label ?? targetId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>Create connection</h3>
        <p className="muted">
          <strong>{sourceName}</strong> → <strong>{targetName}</strong>
        </p>
        <select
          className="connect-type-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
          autoFocus
        >
          {relTypes.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <div className="row">
          <button className="btn btn-primary" onClick={() => onConfirm(type)} disabled={!type}>
            Connect
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

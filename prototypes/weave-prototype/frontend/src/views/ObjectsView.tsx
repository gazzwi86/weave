import LoadingSpinner from '../components/LoadingSpinner';
import { useMemo, useState } from 'react';
import { useGraph, useNodeKinds } from '../hooks/queries';
import DataTable, { type Column } from '../components/DataTable';
import { toObjectRows, type ObjectRow } from '../lib/objects';
import NodeEditModal from '../components/NodeEditModal';
import type { GraphNode } from '../types';

interface Props {
  projectId: string;
}

const dash = <span className="subtle">—</span>;

/** Sortable, filterable table of every node — scales where the canvas can't. */
export default function ObjectsView({ projectId }: Props) {
  const { data: graph, isLoading, isError } = useGraph(projectId);
  const { data: kinds = [] } = useNodeKinds();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('All');
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);

  const rows = useMemo(() => (graph ? toObjectRows(graph) : []), [graph]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (kind === 'All' || r.kind === kind) &&
        (!q || r.label.toLowerCase().includes(q) || r.comment.toLowerCase().includes(q)),
    );
  }, [rows, search, kind]);

  const domains = useMemo(() => graph?.nodes.filter((n) => n.kind === 'BusinessDomain') ?? [], [graph]);
  const capabilities = useMemo(() => graph?.nodes.filter((n) => n.kind === 'BusinessCapability') ?? [], [graph]);
  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);

  if (isLoading) return <LoadingSpinner message="Loading objects…" />;
  if (isError) return <div className="center-state">Could not load the objects.</div>;

  const columns: Column<ObjectRow>[] = [
    {
      key: 'label',
      header: 'Name',
      sortValue: (r) => r.label,
      render: (r) => (
        <span className="cell-name">
          <span className="chip-dot" style={{ background: r.color }} />
          <strong>{r.label}</strong>
        </span>
      ),
    },
    { key: 'kind', header: 'Kind', sortValue: (r) => r.kind, render: (r) => r.kind },
    { key: 'domain', header: 'Domain', sortValue: (r) => r.domain, render: (r) => r.domain || dash },
    {
      key: 'capability',
      header: 'Capability',
      sortValue: (r) => r.capability,
      render: (r) => r.capability || dash,
    },
    {
      key: 'connections',
      header: 'Links',
      sortValue: (r) => r.connections,
      render: (r) => r.connections,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          className="btn btn-sm"
          onClick={() => setEditingNode(nodeById.get(r.id) ?? null)}
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Objects</h2>
            <p className="muted">Every node in this project.</p>
          </div>
        </div>
        <div className="filter-bar">
          <input
            type="search"
            className="filter-input"
            aria-label="Search objects"
            placeholder="Search by name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="All">All kinds</option>
            {kinds.map((k) => (
              <option key={k.key} value={k.key}>{k.key}</option>
            ))}
          </select>
          <span className="muted">{filtered.length} of {rows.length}</span>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          initialSortKey="label"
          empty={<p className="muted">No objects match.</p>}
        />
      </div>

      {editingNode && (
        <NodeEditModal
          projectId={projectId}
          node={editingNode}
          kinds={kinds}
          domains={domains}
          capabilities={capabilities}
          onClose={() => setEditingNode(null)}
        />
      )}
    </div>
  );
}

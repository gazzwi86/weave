import LoadingSpinner from '../components/LoadingSpinner';
import { useMemo, useState } from 'react';
import { useInventory, useGraph, useNodeKinds } from '../hooks/queries';
import DataTable, { type Column } from '../components/DataTable';
import { exportCsv, exportMarkdown } from '../lib/export';
import NodeEditModal from '../components/NodeEditModal';
import type { GraphNode, InventoryItem } from '../types';

interface Props {
  projectId: string;
}

const dash = <span className="subtle">—</span>;

/** Inventory of systems / services: kind, domain, capability, dependencies. */
export default function InventoryView({ projectId }: Props) {
  const { data: items = [], isLoading, isError } = useInventory(projectId);
  const { data: graph } = useGraph(projectId);
  const { data: kinds = [] } = useNodeKinds();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);

  const kindValues = useMemo(() => [...new Set(items.map((i) => i.kind))].sort(), [items]);
  const domainValues = useMemo(() => [...new Set(items.map((i) => i.domain).filter(Boolean) as string[])].sort(), [items]);
  const domainNodes = useMemo(() => graph?.nodes.filter((n) => n.kind === 'BusinessDomain') ?? [], [graph]);
  const capabilityNodes = useMemo(() => graph?.nodes.filter((n) => n.kind === 'BusinessCapability') ?? [], [graph]);
  const nodeById = useMemo(() => new Map((graph?.nodes ?? []).map((n) => [n.id, n])), [graph]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => {
      if (q && !i.label.toLowerCase().includes(q) && !(i.comment ?? '').toLowerCase().includes(q)) return false;
      if (kindFilter && i.kind !== kindFilter) return false;
      if (domainFilter && i.domain !== domainFilter) return false;
      return true;
    });
  }, [items, search, kindFilter, domainFilter]);

  const withDomain = items.filter((i) => i.domain).length;
  const withCapability = items.filter((i) => i.capability).length;
  const withComment = items.filter((i) => i.comment).length;

  if (isLoading) return <LoadingSpinner message="Loading inventory…" />;
  if (isError) return <div className="center-state">Could not load the inventory.</div>;

  const columns: Column<InventoryItem>[] = [
    {
      key: 'label',
      header: 'Name',
      sortValue: (i) => i.label,
      render: (i) => <strong>{i.label}</strong>,
    },
    { key: 'kind', header: 'Kind', sortValue: (i) => i.kind, render: (i) => i.kind },
    {
      key: 'domain',
      header: 'Domain',
      sortValue: (i) => i.domain ?? '',
      render: (i) => i.domain || dash,
    },
    {
      key: 'capability',
      header: 'Capability',
      sortValue: (i) => i.capability ?? '',
      render: (i) => i.capability || dash,
    },
    {
      key: 'depends_on',
      header: 'Depends on',
      render: (i) => (i.depends_on.length ? i.depends_on.join(', ') : dash),
    },
    {
      key: 'actions',
      header: '',
      render: (i) => (
        <button className="btn btn-sm" onClick={() => setEditingNode(nodeById.get(i.id) ?? null)}>
          Edit
        </button>
      ),
    },
  ];

  const headers = ['Name', 'Kind', 'Domain', 'Capability', 'Depends on'];
  const exportRows = () =>
    filtered.map((i) => [i.label, i.kind, i.domain ?? '', i.capability ?? '', i.depends_on.join(', ')]);

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Inventory</h2>
            <p className="muted">Systems and services in this project.</p>
          </div>
          {items.length > 0 && (
            <div className="export-bar">
              <button className="btn btn-sm" onClick={() => exportCsv('inventory.csv', headers, exportRows())}>CSV</button>
              <button className="btn btn-sm" onClick={() => exportMarkdown('inventory.md', headers, exportRows())}>MD</button>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            <div className="inv-stats">
              <span className="inv-stat"><strong>{items.length}</strong> items</span>
              <span className="inv-stat"><strong>{withDomain}</strong> with domain ({Math.round(withDomain / items.length * 100)}%)</span>
              <span className="inv-stat"><strong>{withCapability}</strong> with capability ({Math.round(withCapability / items.length * 100)}%)</span>
              <span className="inv-stat"><strong>{withComment}</strong> described ({Math.round(withComment / items.length * 100)}%)</span>
            </div>

            <div className="filter-bar">
              <input
                className="filter-input"
                placeholder="Search name or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select className="filter-select" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
                <option value="">All kinds</option>
                {kindValues.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {domainValues.length > 0 && (
                <select className="filter-select" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
                  <option value="">All domains</option>
                  {domainValues.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              {(search || kindFilter || domainFilter) && (
                <button className="btn btn-sm" onClick={() => { setSearch(''); setKindFilter(''); setDomainFilter(''); }}>
                  Clear
                </button>
              )}
            </div>
          </>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(i) => i.id}
          initialSortKey="label"
          empty={<p className="muted">
            {items.length === 0 ? 'No systems or services yet.' : 'No items match the current filters.'}
          </p>}
        />
      </div>

      {editingNode && (
        <NodeEditModal
          projectId={projectId}
          node={editingNode}
          kinds={kinds}
          domains={domainNodes}
          capabilities={capabilityNodes}
          onClose={() => setEditingNode(null)}
        />
      )}
    </div>
  );
}

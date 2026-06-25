import LoadingSpinner from '../components/LoadingSpinner';
import { useMemo, useState } from 'react';
import { useGraph } from '../hooks/queries';
import type { GraphNode } from '../types';

interface Props {
  projectId: string;
}

type DimensionKey = 'maturity' | 'investment_level' | 'strategic_importance' | 'lifecycle_status';

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'maturity', label: 'Maturity' },
  { key: 'investment_level', label: 'Investment' },
  { key: 'strategic_importance', label: 'Strategic importance' },
  { key: 'lifecycle_status', label: 'Lifecycle status' },
];

const MATURITY_COLORS: Record<string, string> = {
  '1': '#fee2e2', '2': '#fef3c7', '3': '#dbeafe', '4': '#d1fae5', '5': '#ede9fe',
};
const INVESTMENT_COLORS: Record<string, string> = {
  High: '#d1fae5', Medium: '#dbeafe', Low: '#fef3c7', None: '#f1f5f9',
};
const STRATEGIC_COLORS: Record<string, string> = {
  Differentiation: '#ede9fe', Innovation: '#fce7f3', Commodity: '#f1f5f9',
};
const LIFECYCLE_COLORS: Record<string, string> = {
  'Phase In': '#dbeafe', Active: '#d1fae5', 'Phase Out': '#fef3c7', 'End of Life': '#fee2e2', Plan: '#f1f5f9',
};

function colorForDimension(node: GraphNode, dim: DimensionKey): string {
  const val = node[dim] ?? '';
  switch (dim) {
    case 'maturity': return MATURITY_COLORS[val] ?? '#f8fafc';
    case 'investment_level': return INVESTMENT_COLORS[val] ?? '#f8fafc';
    case 'strategic_importance': return STRATEGIC_COLORS[val] ?? '#f8fafc';
    case 'lifecycle_status': return LIFECYCLE_COLORS[val] ?? '#f8fafc';
  }
}

/** Capability map: domains as sections, capabilities as heat-mapped cards. */
export default function CapabilityView({ projectId }: Props) {
  const graphQuery = useGraph(projectId);
  const [dimension, setDimension] = useState<DimensionKey>('maturity');

  const { domains, byDomain, unassigned } = useMemo(() => {
    const graph = graphQuery.data;
    if (!graph) return { domains: [], byDomain: new Map<string, GraphNode[]>(), unassigned: [] };

    const domainNodes = graph.nodes.filter((n) => n.kind === 'BusinessDomain');
    const capNodes = graph.nodes.filter((n) => n.kind === 'BusinessCapability');
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    const grouped = new Map<string, GraphNode[]>();
    const unassignedCaps: GraphNode[] = [];

    for (const cap of capNodes) {
      if (cap.domain && nodeById.has(cap.domain)) {
        const list = grouped.get(cap.domain) ?? [];
        list.push(cap);
        grouped.set(cap.domain, list);
      } else {
        unassignedCaps.push(cap);
      }
    }

    return { domains: domainNodes, byDomain: grouped, unassigned: unassignedCaps };
  }, [graphQuery.data]);

  if (graphQuery.isLoading) return <LoadingSpinner message="Loading capabilities…" />;
  if (graphQuery.isError) return <div className="center-state">Could not load graph.</div>;

  const isEmpty = domains.length === 0 && unassigned.length === 0;

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Capabilities</h2>
            <p className="muted">Business capabilities grouped by domain.</p>
          </div>
          <div className="cap-controls">
            <label className="cap-dim-label" htmlFor="cap-dimension">Colour by</label>
            <select
              id="cap-dimension"
              className="cap-dim-select"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as DimensionKey)}
            >
              {DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        <DimensionLegend dimension={dimension} />

        {isEmpty ? (
          <p className="muted">
            No capabilities yet. Add <code>BusinessDomain</code> and <code>BusinessCapability</code>{' '}
            nodes, then assign capabilities to domains via the inspector.
          </p>
        ) : (
          <div className="cap-map">
            {domains.map((domain) => (
              <DomainSection
                key={domain.id}
                domain={domain}
                capabilities={byDomain.get(domain.id) ?? []}
                dimension={dimension}
              />
            ))}
            {unassigned.length > 0 && (
              <DomainSection
                domain={{ id: '__unassigned', label: 'Unassigned', kind: 'BusinessDomain', color: '#94a3b8' }}
                capabilities={unassigned}
                dimension={dimension}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DimensionLegend({ dimension }: { dimension: DimensionKey }) {
  const swatches: Record<DimensionKey, Record<string, string>> = {
    maturity: { '1 – Initial': '#fee2e2', '2 – Developing': '#fef3c7', '3 – Defined': '#dbeafe', '4 – Managed': '#d1fae5', '5 – Optimising': '#ede9fe' },
    investment_level: INVESTMENT_COLORS,
    strategic_importance: STRATEGIC_COLORS,
    lifecycle_status: LIFECYCLE_COLORS,
  };
  const entries = Object.entries(swatches[dimension]);
  return (
    <div className="cap-legend">
      {entries.map(([label, color]) => (
        <span key={label} className="cap-legend-item">
          <span className="cap-legend-dot" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function DomainSection({
  domain,
  capabilities,
  dimension,
}: {
  domain: GraphNode | { id: string; label: string; kind: string; color: string };
  capabilities: GraphNode[];
  dimension: DimensionKey;
}) {
  return (
    <section className="cap-domain">
      <div className="cap-domain-header" style={{ borderLeftColor: domain.color }}>
        <span className="cap-domain-dot" style={{ background: domain.color }} />
        <h3 className="cap-domain-title">{domain.label}</h3>
        <span className="cap-domain-count">{capabilities.length}</span>
      </div>
      {capabilities.length === 0 ? (
        <p className="muted cap-empty">No capabilities assigned.</p>
      ) : (
        <div className="cap-cards">
          {capabilities.map((cap) => (
            <CapabilityCard key={cap.id} cap={cap} dimension={dimension} />
          ))}
        </div>
      )}
    </section>
  );
}

function CapabilityCard({ cap, dimension }: { cap: GraphNode; dimension: DimensionKey }) {
  const bg = colorForDimension(cap, dimension);
  return (
    <div className="cap-card" style={{ background: bg }}>
      <div className="cap-card-name">{cap.label}</div>
      {cap.comment && <p className="cap-card-desc">{cap.comment}</p>}
      <div className="cap-card-meta">
        {cap.maturity && <span className="cap-meta-item">Maturity: {cap.maturity}/5</span>}
        {cap.strategic_importance && <span className="cap-meta-item">{cap.strategic_importance}</span>}
        {cap.lifecycle_status && <span className="cap-meta-item">{cap.lifecycle_status}</span>}
        {cap.investment_level && <span className="cap-meta-item cap-meta-invest">{cap.investment_level} investment</span>}
        {cap.capability_owner && <span className="cap-meta-item">Owner: {cap.capability_owner}</span>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Graph, GraphEdge, GraphNode, NodeKind, RelationshipType } from '../types';
import {
  useCreateEdge,
  useDeleteEdge,
  useDeleteNode,
  useRelationshipTypes,
  useUpdateNode,
} from '../hooks/queries';
import { labelOf } from '../lib/graph';
import FormField from './FormField';

export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

interface Props {
  projectId: string;
  graph: Graph;
  kinds: NodeKind[];
  selection: Selection;
  onClear: () => void;
}

/** Right drawer: details + edit/delete for the selected node or edge. */
export default function Inspector({
  projectId,
  graph,
  kinds,
  selection,
  onClear,
}: Props) {
  const { data: relTypes = [] } = useRelationshipTypes();

  if (!selection) {
    return (
      <aside className="inspector">
        <p className="inspector-empty">Select a node or edge to inspect it.</p>
      </aside>
    );
  }

  if (selection.kind === 'node') {
    const node = graph.nodes.find((n) => n.id === selection.id);
    if (!node) return <EmptyInspector />;
    return (
      <NodeInspector
        projectId={projectId}
        graph={graph}
        kinds={kinds}
        relTypes={relTypes}
        node={node}
        onClear={onClear}
      />
    );
  }

  const edge = graph.edges.find((e) => e.id === selection.id);
  if (!edge) return <EmptyInspector />;
  return <EdgeInspector projectId={projectId} graph={graph} edge={edge} onClear={onClear} />;
}

function EmptyInspector() {
  return (
    <aside className="inspector">
      <p className="inspector-empty">Selection no longer exists.</p>
    </aside>
  );
}

function NodeInspector({
  projectId,
  graph,
  kinds,
  relTypes,
  node,
  onClear,
}: {
  projectId: string;
  graph: Graph;
  kinds: NodeKind[];
  relTypes: RelationshipType[];
  node: GraphNode;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingEdge, setAddingEdge] = useState(false);
  const [label, setLabel] = useState(node.label);
  const [kind, setKind] = useState(node.kind);
  const [comment, setComment] = useState(node.comment ?? '');
  const [note, setNote] = useState(node.note ?? '');
  const [domain, setDomain] = useState(node.domain ?? '');
  const [capability, setCapability] = useState(node.capability ?? '');
  const [maturity, setMaturity] = useState(node.maturity ?? '');
  const [strategicImportance, setStrategicImportance] = useState(node.strategic_importance ?? '');
  const [investmentLevel, setInvestmentLevel] = useState(node.investment_level ?? '');
  const [lifecycleStatus, setLifecycleStatus] = useState(node.lifecycle_status ?? '');
  const [capabilityOwner, setCapabilityOwner] = useState(node.capability_owner ?? '');

  const update = useUpdateNode(projectId);
  const remove = useDeleteNode(projectId);
  const deleteEdge = useDeleteEdge(projectId);
  const createEdge = useCreateEdge(projectId);

  // New edge form state
  const [edgeTarget, setEdgeTarget] = useState('');
  const [edgeType, setEdgeType] = useState(relTypes[0]?.key ?? '');

  useEffect(() => {
    setEditing(false);
    setAddingEdge(false);
    setLabel(node.label);
    setKind(node.kind);
    setComment(node.comment ?? '');
    setNote(node.note ?? '');
    setDomain(node.domain ?? '');
    setCapability(node.capability ?? '');
    setMaturity(node.maturity ?? '');
    setStrategicImportance(node.strategic_importance ?? '');
    setInvestmentLevel(node.investment_level ?? '');
    setLifecycleStatus(node.lifecycle_status ?? '');
    setCapabilityOwner(node.capability_owner ?? '');
  }, [node.id, node.label, node.kind, node.comment, node.note, node.domain, node.capability,
      node.maturity, node.strategic_importance, node.investment_level, node.lifecycle_status, node.capability_owner]);

  useEffect(() => {
    if (relTypes.length > 0 && !edgeType) setEdgeType(relTypes[0].key);
  }, [relTypes, edgeType]);

  const outgoing = graph.edges.filter((e) => e.source === node.id);
  const incoming = graph.edges.filter((e) => e.target === node.id);
  const domains = graph.nodes.filter((n) => n.kind === 'BusinessDomain');
  const capabilities = graph.nodes.filter((n) => n.kind === 'BusinessCapability');
  const otherNodes = graph.nodes.filter((n) => n.id !== node.id);

  function save() {
    update.mutate({
      nodeId: node.id,
      body: {
        label: label.trim() || node.label,
        kind,
        comment: comment.trim() || null,
        note: note.trim() || null,
        domain: domain || null,
        capability: capability || null,
        maturity: maturity || null,
        strategic_importance: strategicImportance || null,
        investment_level: investmentLevel || null,
        lifecycle_status: lifecycleStatus || null,
        capability_owner: capabilityOwner || null,
      },
    });
    setEditing(false);
  }

  function del() {
    if (!window.confirm(`Delete node "${node.label}"?`)) return;
    remove.mutate(node.id, { onSuccess: onClear });
  }

  function delEdge(edge: GraphEdge) {
    deleteEdge.mutate({ source: edge.source, target: edge.target, type: edge.type });
  }

  function addEdge() {
    if (!edgeTarget || !edgeType) return;
    createEdge.mutate(
      { source: node.id, target: edgeTarget, type: edgeType },
      { onSuccess: () => { setAddingEdge(false); setEdgeTarget(''); } },
    );
  }

  if (editing) {
    return (
      <aside className="inspector">
        <h3>Edit node</h3>
        <FormField id="insp-label" label="Label">
          <input id="insp-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        <FormField id="insp-kind" label="Kind">
          <select id="insp-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k.key} value={k.key}>{k.key}</option>
            ))}
          </select>
        </FormField>
        <FormField id="insp-comment" label="Comment">
          <textarea
            id="insp-comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </FormField>
        <FormField id="insp-note" label="Note">
          <textarea
            id="insp-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
        {domains.length > 0 && (
          <FormField id="insp-domain" label="Domain">
            <select id="insp-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">— none —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </FormField>
        )}
        {capabilities.length > 0 && (
          <FormField id="insp-cap" label="Capability">
            <select id="insp-cap" value={capability} onChange={(e) => setCapability(e.target.value)}>
              <option value="">— none —</option>
              {capabilities.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </FormField>
        )}
        {kind === 'BusinessCapability' && (
          <>
            <FormField id="insp-maturity" label="Maturity (1–5)">
              <select id="insp-maturity" value={maturity} onChange={(e) => setMaturity(e.target.value)}>
                <option value="">— none —</option>
                {['1', '2', '3', '4', '5'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormField>
            <FormField id="insp-strategic" label="Strategic importance">
              <select id="insp-strategic" value={strategicImportance} onChange={(e) => setStrategicImportance(e.target.value)}>
                <option value="">— none —</option>
                {['Commodity', 'Differentiation', 'Innovation'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormField>
            <FormField id="insp-invest" label="Investment level">
              <select id="insp-invest" value={investmentLevel} onChange={(e) => setInvestmentLevel(e.target.value)}>
                <option value="">— none —</option>
                {['High', 'Medium', 'Low', 'None'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormField>
            <FormField id="insp-lifecycle" label="Lifecycle status">
              <select id="insp-lifecycle" value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value)}>
                <option value="">— none —</option>
                {['Plan', 'Phase In', 'Active', 'Phase Out', 'End of Life'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </FormField>
            <FormField id="insp-owner" label="Owner">
              <input id="insp-owner" value={capabilityOwner} onChange={(e) => setCapabilityOwner(e.target.value)} placeholder="Team or person" />
            </FormField>
          </>
        )}
        <div className="row">
          <button className="btn btn-primary" onClick={save} disabled={update.isPending}>
            Save
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <h3>{node.label}</h3>
      <span className="chip">
        <span className="chip-dot" style={{ background: node.color }} />
        {node.kind}
      </span>

      <Detail label="Comment" value={node.comment} />
      <Detail label="Note" value={node.note} />
      <Detail label="Domain" value={node.domain ? labelOf(graph, node.domain) : null} />
      <Detail label="Capability" value={node.capability ? labelOf(graph, node.capability) : null} />
      <Detail label="Maturity" value={node.maturity} />
      <Detail label="Strategic importance" value={node.strategic_importance} />
      <Detail label="Investment" value={node.investment_level} />
      <Detail label="Lifecycle" value={node.lifecycle_status} />
      <Detail label="Owner" value={node.capability_owner} />

      <EditableEdgeSection
        title="Outgoing"
        edges={outgoing}
        render={(e) => `${e.label} → ${labelOf(graph, e.target)}`}
        onDelete={delEdge}
      />
      <EditableEdgeSection
        title="Incoming"
        edges={incoming}
        render={(e) => `${labelOf(graph, e.source)} → ${e.label}`}
        onDelete={delEdge}
      />

      {addingEdge ? (
        <div className="inspector-section">
          <h4>Add connection</h4>
          <FormField id="insp-edge-target" label="Target">
            <select id="insp-edge-target" value={edgeTarget} onChange={(e) => setEdgeTarget(e.target.value)}>
              <option value="">— select —</option>
              {otherNodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </FormField>
          <FormField id="insp-edge-type" label="Type">
            <select id="insp-edge-type" value={edgeType} onChange={(e) => setEdgeType(e.target.value)}>
              {relTypes.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </FormField>
          <div className="row">
            <button className="btn btn-primary" onClick={addEdge} disabled={!edgeTarget || createEdge.isPending}>
              Add
            </button>
            <button className="btn" onClick={() => setAddingEdge(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm inspector-add-edge" onClick={() => setAddingEdge(true)}>
          + Add connection
        </button>
      )}

      <div className="row">
        <button className="btn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="btn btn-danger" onClick={del} disabled={remove.isPending}>
          Delete
        </button>
      </div>
    </aside>
  );
}

function EdgeInspector({
  projectId,
  graph,
  edge,
  onClear,
}: {
  projectId: string;
  graph: Graph;
  edge: GraphEdge;
  onClear: () => void;
}) {
  const remove = useDeleteEdge(projectId);

  function del() {
    if (!window.confirm('Delete this relationship?')) return;
    remove.mutate(
      { source: edge.source, target: edge.target, type: edge.type },
      { onSuccess: onClear },
    );
  }

  return (
    <aside className="inspector">
      <h3>{edge.label}</h3>
      <span className="chip">relationship</span>
      <Detail label="From" value={labelOf(graph, edge.source)} />
      <Detail label="To" value={labelOf(graph, edge.target)} />
      <Detail label="Type" value={edge.type} />
      <Detail label="Comment" value={edge.comment} />
      <Detail label="Note" value={edge.note} />
      <div className="row">
        <button className="btn btn-danger" onClick={del} disabled={remove.isPending}>
          Delete
        </button>
      </div>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <div className="k">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function EditableEdgeSection({
  title,
  edges,
  render,
  onDelete,
}: {
  title: string;
  edges: GraphEdge[];
  render: (e: GraphEdge) => string;
  onDelete: (e: GraphEdge) => void;
}) {
  if (edges.length === 0) return null;
  return (
    <div className="inspector-section">
      <h4>{title} ({edges.length})</h4>
      <ul className="edge-list">
        {edges.map((e) => (
          <li key={e.id} className="edge-list-item">
            <span className="edge-list-label">{render(e)}</span>
            <button
              className="edge-list-delete"
              title="Remove connection"
              onClick={() => onDelete(e)}
              aria-label="Delete connection"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

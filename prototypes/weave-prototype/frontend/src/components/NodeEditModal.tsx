import { useEffect, useState } from 'react';
import type { GraphNode, NodeKind } from '../types';
import { useUpdateNode, useDeleteNode } from '../hooks/queries';
import FormField from './FormField';

interface Props {
  projectId: string;
  node: GraphNode;
  kinds: NodeKind[];
  domains: GraphNode[];
  capabilities: GraphNode[];
  onClose: () => void;
}

/** Inline edit modal for any node, usable from table views (Objects, Inventory). */
export default function NodeEditModal({ projectId, node, kinds, domains, capabilities, onClose }: Props) {
  const update = useUpdateNode(projectId);
  const remove = useDeleteNode(projectId);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function save() {
    update.mutate(
      {
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
      },
      { onSuccess: onClose },
    );
  }

  function del() {
    if (!window.confirm(`Delete "${node.label}"? This cannot be undone.`)) return;
    remove.mutate(node.id, { onSuccess: onClose });
  }

  const isCapability = kind === 'BusinessCapability';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box node-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit: {node.label}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="node-edit-fields">
          <FormField id="ned-label" label="Label">
            <input id="ned-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </FormField>
          <FormField id="ned-kind" label="Kind">
            <select id="ned-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => <option key={k.key} value={k.key}>{k.key}</option>)}
            </select>
          </FormField>
          <FormField id="ned-comment" label="Description">
            <textarea id="ned-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </FormField>
          <FormField id="ned-note" label="Note">
            <input id="ned-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          {domains.length > 0 && (
            <FormField id="ned-domain" label="Domain">
              <select id="ned-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="">— none —</option>
                {domains.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </FormField>
          )}
          {capabilities.length > 0 && (
            <FormField id="ned-cap" label="Capability">
              <select id="ned-cap" value={capability} onChange={(e) => setCapability(e.target.value)}>
                <option value="">— none —</option>
                {capabilities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </FormField>
          )}
          {isCapability && (
            <>
              <FormField id="ned-mat" label="Maturity (1–5)">
                <select id="ned-mat" value={maturity} onChange={(e) => setMaturity(e.target.value)}>
                  <option value="">— none —</option>
                  {['1','2','3','4','5'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField id="ned-strat" label="Strategic importance">
                <select id="ned-strat" value={strategicImportance} onChange={(e) => setStrategicImportance(e.target.value)}>
                  <option value="">— none —</option>
                  {['Commodity','Differentiation','Innovation'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField id="ned-invest" label="Investment">
                <select id="ned-invest" value={investmentLevel} onChange={(e) => setInvestmentLevel(e.target.value)}>
                  <option value="">— none —</option>
                  {['High','Medium','Low','None'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField id="ned-life" label="Lifecycle">
                <select id="ned-life" value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value)}>
                  <option value="">— none —</option>
                  {['Plan','Phase In','Active','Phase Out','End of Life'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField id="ned-owner" label="Owner">
                <input id="ned-owner" value={capabilityOwner} onChange={(e) => setCapabilityOwner(e.target.value)} />
              </FormField>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-danger" onClick={del} disabled={remove.isPending}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

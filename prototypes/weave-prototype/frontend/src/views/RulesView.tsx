import LoadingSpinner from '../components/LoadingSpinner';
import { useMemo, useState } from 'react';
import { useNodeKinds, useRelationshipTypes, useRules, useCreateRule, useDeleteRule } from '../hooks/queries';
import { groupRules, humanizeKind } from '../lib/rules';
import FormField from '../components/FormField';
import type { Rule } from '../types';

interface Props {
  projectId: string;
}

/**
 * Constraint rules: SHACL-derived if/then rules grouped by category,
 * plus the ability to add and delete custom rules.
 */
export default function RulesView(_props: Props) {
  const { data: rules = [], isLoading, isError } = useRules();
  const { data: relTypes = [] } = useRelationshipTypes();
  const { data: kinds = [] } = useNodeKinds();
  const groups = useMemo(() => groupRules(rules), [rules]);
  const ruleByRel = useMemo(() => new Map(rules.map((r) => [r.relationship, r])), [rules]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  if (isLoading) return <LoadingSpinner message="Loading rules…" />;
  if (isError) return <div className="center-state">Could not load the rules.</div>;

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Rules</h2>
            <p className="muted">
              Constraints that govern the graph — enforced whenever changes are saved.
            </p>
          </div>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '＋ Add rule'}
          </button>
        </div>

        {showForm && (
          <AddRuleForm
            relTypes={relTypes}
            kinds={kinds}
            onClose={() => setShowForm(false)}
          />
        )}

        {editingRule && (
          <EditRuleModal
            rule={editingRule}
            relTypes={relTypes}
            kinds={kinds}
            onClose={() => setEditingRule(null)}
          />
        )}

        {rules.length === 0 ? (
          <p className="muted">No rules are defined yet.</p>
        ) : (
          groups.map(([category, items]) => (
            <RuleGroup key={category} category={category} rules={items} onEdit={setEditingRule} />
          ))
        )}

        {relTypes.length > 0 && (
          <section className="rule-group">
            <h3 className="rule-group-title">Relationship vocabulary</h3>
            <p className="muted vocab-intro">
              Every relationship type you can draw between two nodes. Those with an
              enforced range rule are marked; the rest may link any two nodes.
            </p>
            <ul className="vocab-list">
              {relTypes.map((rel) => {
                const rule = ruleByRel.get(rel.key);
                return (
                  <li className="vocab-item" key={rel.key}>
                    <code className="rule-rel">{rel.label}</code>
                    {rule ? (
                      <span className="vocab-badge vocab-badge-ruled">
                        → must be a {humanizeKind(rule.object_kind)}
                      </span>
                    ) : (
                      <span className="vocab-badge">no range rule</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function RuleGroup({
  category,
  rules,
  onEdit,
}: {
  category: string;
  rules: ReturnType<typeof groupRules>[number][1];
  onEdit: (rule: Rule) => void;
}) {
  const deleteRule = useDeleteRule();
  return (
    <section className="rule-group">
      <h3 className="rule-group-title">
        {category}
        {category === 'Custom' && <span className="rule-group-hint"> — click Edit to modify</span>}
      </h3>
      <ul className="rule-list">
        {rules.map((rule) => (
          <li className="rule-card" key={rule.id}>
            <div className="rule-card-body">
              <p className="rule-line">
                <span className="rule-kw">IF</span> a node{' '}
                <code className="rule-rel">{rule.relationship}</code> something
              </p>
              <p className="rule-line">
                <span className="rule-kw rule-kw-then">THEN</span> that target must be a{' '}
                <span className="rule-kind">{humanizeKind(rule.object_kind)}</span>{' '}
                <code className="rule-curie">{rule.object_kind_curie}</code>
              </p>
              {rule.message && <p className="rule-note">{rule.message}</p>}
              {!rule.is_custom && (
                <p className="rule-static-note">Static constraint — enforced by built-in SHACL shapes.</p>
              )}
            </div>
            {rule.is_custom && (
              <div className="rule-actions">
                <button className="btn btn-sm" onClick={() => onEdit(rule)}>Edit</button>
                <button
                  className="rule-delete"
                  title="Remove custom rule"
                  onClick={() => deleteRule.mutate(rule.id)}
                  disabled={deleteRule.isPending}
                  aria-label="Delete rule"
                >
                  ×
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RuleForm({
  title,
  relTypes,
  kinds,
  initial,
  onSubmit,
  onClose,
  isPending,
}: {
  title: string;
  relTypes: { key: string; label: string }[];
  kinds: { key: string }[];
  initial?: { relationship: string; object_kind: string; severity: string; message: string };
  onSubmit: (vals: { relationship: string; object_kind: string; severity: string; message: string | null }) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [relationship, setRelationship] = useState(initial?.relationship ?? relTypes[0]?.key ?? '');
  const [objectKind, setObjectKind] = useState(initial?.object_kind ?? kinds[0]?.key ?? '');
  const [severity, setSeverity] = useState(initial?.severity ?? 'Violation');
  const [message, setMessage] = useState(initial?.message ?? '');

  return (
    <div className="rule-add-form">
      <h3>{title}</h3>
      <p className="muted">
        When a node uses a relationship, what kind must the target be?
      </p>
      <div className="rule-form-fields">
        <FormField id="rule-rel" label="Relationship">
          <select id="rule-rel" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {relTypes.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </FormField>
        <FormField id="rule-kind" label="Target must be a">
          <select id="rule-kind" value={objectKind} onChange={(e) => setObjectKind(e.target.value)}>
            {kinds.map((k) => <option key={k.key} value={k.key}>{k.key}</option>)}
          </select>
        </FormField>
        <FormField id="rule-sev" label="Severity">
          <select id="rule-sev" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="Violation">Violation (blocks save)</option>
            <option value="Warning">Warning (advisory)</option>
            <option value="Info">Info</option>
          </select>
        </FormField>
        <FormField id="rule-msg" label="Message (optional)">
          <input id="rule-msg" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Explain the constraint…" />
        </FormField>
      </div>
      <div className="row">
        <button
          className="btn btn-primary"
          onClick={() => onSubmit({ relationship, object_kind: objectKind, severity, message: message || null })}
          disabled={!relationship || !objectKind || isPending}
        >
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Add rule'}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function AddRuleForm({ relTypes, kinds, onClose }: { relTypes: { key: string; label: string }[]; kinds: { key: string }[]; onClose: () => void }) {
  const createRule = useCreateRule();
  return (
    <RuleForm
      title="Add constraint rule"
      relTypes={relTypes}
      kinds={kinds}
      onSubmit={(vals) => createRule.mutate(vals, { onSuccess: onClose })}
      onClose={onClose}
      isPending={createRule.isPending}
    />
  );
}

function EditRuleModal({ rule, relTypes, kinds, onClose }: { rule: Rule; relTypes: { key: string; label: string }[]; kinds: { key: string }[]; onClose: () => void }) {
  const createRule = useCreateRule();
  const deleteRule = useDeleteRule();

  function save(vals: { relationship: string; object_kind: string; severity: string; message: string | null }) {
    deleteRule.mutate(rule.id, {
      onSuccess: () => {
        createRule.mutate(vals, { onSuccess: onClose });
      },
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <RuleForm
          title="Edit rule"
          relTypes={relTypes}
          kinds={kinds}
          initial={{ relationship: rule.relationship, object_kind: rule.object_kind, severity: rule.severity, message: rule.message ?? '' }}
          onSubmit={save}
          onClose={onClose}
          isPending={deleteRule.isPending || createRule.isPending}
        />
      </div>
    </div>
  );
}

import LoadingSpinner from '../components/LoadingSpinner';
import { useMemo, useState } from 'react';
import { useGlossary, useUpdateNode } from '../hooks/queries';
import DataTable, { type Column } from '../components/DataTable';
import { localName } from '../lib/graph';
import { exportCsv, exportMarkdown } from '../lib/export';
import type { GlossaryTerm } from '../types';

interface Props {
  projectId: string;
}

const dash = <span className="subtle">—</span>;

/** SKOS concept glossary: label, definition, related terms, with inline editing and search. */
export default function GlossaryView({ projectId }: Props) {
  const { data: terms = [], isLoading, isError } = useGlossary(projectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const updateNode = useUpdateNode(projectId);

  const labelById = useMemo(() => new Map(terms.map((t) => [t.id, t.label])), [terms]);

  const filtered = useMemo(() => {
    if (!search.trim()) return terms;
    const q = search.toLowerCase();
    return terms.filter((t) =>
      t.label.toLowerCase().includes(q) ||
      (t.definition ?? '').toLowerCase().includes(q) ||
      t.related.some((id) => (labelById.get(id) ?? '').toLowerCase().includes(q)),
    );
  }, [terms, search, labelById]);

  if (isLoading) return <LoadingSpinner message="Loading glossary…" />;
  if (isError) return <div className="center-state">Could not load the glossary.</div>;

  function startEdit(id: string) { setEditingId(id); }
  function cancelEdit() { setEditingId(null); }

  function saveEdit(term: GlossaryTerm, newLabel: string, newDef: string) {
    updateNode.mutate(
      { nodeId: term.id, body: { label: newLabel || term.label, comment: newDef || null } },
      { onSuccess: () => setEditingId(null) },
    );
  }

  const columns: Column<GlossaryTerm>[] = [
    {
      key: 'label',
      header: 'Term',
      sortValue: (t) => t.label,
      render: (t) => {
        if (editingId === t.id) return null; // inline edit row handles this
        return <strong>{t.label}</strong>;
      },
    },
    {
      key: 'definition',
      header: 'Definition',
      sortValue: (t) => t.definition ?? '',
      render: (t) => {
        if (editingId === t.id) return null;
        return t.definition || dash;
      },
    },
    {
      key: 'related',
      header: 'Related',
      render: (t) => {
        if (editingId === t.id) return null;
        return t.related.length
          ? t.related.map((id) => labelById.get(id) ?? localName(id)).join(', ')
          : dash;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (t) => {
        if (editingId === t.id) return null;
        return (
          <button className="btn btn-sm" onClick={() => startEdit(t.id)}>
            Edit
          </button>
        );
      },
    },
  ];

  function rows(): string[][] {
    return terms.map((t) => [
      t.label,
      t.definition ?? '',
      t.related.map((id) => labelById.get(id) ?? localName(id)).join(', '),
    ]);
  }

  const headers = ['Term', 'Definition', 'Related'];

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Glossary</h2>
            <p className="muted">SKOS concepts in this project.</p>
          </div>
          {terms.length > 0 && (
            <div className="export-bar">
              <button className="btn btn-sm" onClick={() => exportCsv('glossary.csv', headers, rows())}>
                CSV
              </button>
              <button className="btn btn-sm" onClick={() => exportMarkdown('glossary.md', headers, rows())}>
                MD
              </button>
            </div>
          )}
        </div>

        {terms.length > 0 && (
          <div className="filter-bar">
            <input
              className="filter-input"
              placeholder="Search term, definition, or related…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="btn btn-sm" onClick={() => setSearch('')}>Clear</button>
            )}
            <span className="muted">{filtered.length} / {terms.length}</span>
          </div>
        )}

        {editingId ? (
          <GlossaryEditRow
            term={terms.find((t) => t.id === editingId)!}
            onSave={saveEdit}
            onCancel={cancelEdit}
            isPending={updateNode.isPending}
          />
        ) : null}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(t) => t.id}
          initialSortKey="label"
          empty={<p className="muted">{terms.length === 0 ? 'No concepts yet.' : 'No terms match.'}</p>}
        />
      </div>
    </div>
  );
}

function GlossaryEditRow({
  term,
  onSave,
  onCancel,
  isPending,
}: {
  term: GlossaryTerm;
  onSave: (term: GlossaryTerm, label: string, def: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [label, setLabel] = useState(term.label);
  const [def, setDef] = useState(term.definition ?? '');

  return (
    <div className="glossary-edit-row">
      <h4 className="glossary-edit-title">Editing: {term.label}</h4>
      <div className="glossary-edit-fields">
        <div className="glossary-edit-field">
          <label htmlFor="gloss-label">Term</label>
          <input id="gloss-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="glossary-edit-field">
          <label htmlFor="gloss-def">Definition</label>
          <textarea
            id="gloss-def"
            rows={3}
            value={def}
            onChange={(e) => setDef(e.target.value)}
          />
        </div>
      </div>
      <div className="row">
        <button className="btn btn-primary" onClick={() => onSave(term, label, def)} disabled={isPending}>
          Save
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

import LoadingSpinner from '../components/LoadingSpinner';
import { useState } from 'react';
import { useSnapshots, useCreateSnapshot, useRestoreSnapshot, useShipSnapshot } from '../hooks/queries';
import type { Snapshot } from '../types';

interface Props {
  projectId: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6b7280' },
  released: { label: 'Released', color: '#16a34a' },
  deprecated: { label: 'Deprecated', color: '#d97706' },
};

/** Named snapshot timeline with status (draft → released → deprecated) lifecycle. */
export default function VersionsView({ projectId }: Props) {
  const { data: snapshots = [], isLoading, isError } = useSnapshots(projectId);
  const createSnapshot = useCreateSnapshot(projectId);
  const restoreSnapshot = useRestoreSnapshot(projectId);
  const shipSnapshot = useShipSnapshot(projectId);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  function commit() {
    if (!label.trim()) return;
    createSnapshot.mutate(
      { label: label.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setLabel('');
          setDescription('');
          setShowForm(false);
        },
      },
    );
  }

  function restore(snap: Snapshot) {
    if (!window.confirm(`Restore to "${snap.label}"? The current graph will be replaced.`)) return;
    restoreSnapshot.mutate(snap.id);
  }

  function ship(snap: Snapshot) {
    if (!window.confirm(`Ship "${snap.label}"? It will be marked as Released and any previously released version will be Deprecated.`)) return;
    shipSnapshot.mutate(snap.id);
  }

  if (isLoading) return <LoadingSpinner message="Loading versions…" />;
  if (isError) return <div className="center-state">Could not load versions.</div>;

  const released = snapshots.find((s) => s.status === 'released');

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Versions</h2>
            <p className="muted">
              Commit named checkpoints of your ontology. Ship a version to mark it as the current
              release — previous releases are automatically deprecated.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '＋ Commit version'}
          </button>
        </div>

        {released && (
          <div className="version-current-banner">
            <span className="version-badge version-badge-released">Released</span>
            <strong>{released.label}</strong>
            <span className="muted">{released.node_count} nodes · {released.edge_count} edges</span>
          </div>
        )}

        {showForm && (
          <div className="version-commit-form">
            <h3>Commit new version</h3>
            <p className="muted">
              Saves the current graph as a named snapshot. You can ship it later to mark it as
              the current released version.
            </p>
            <div className="version-form-fields">
              <div className="version-form-field">
                <label htmlFor="ver-label">Label <span className="required">*</span></label>
                <input
                  id="ver-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. v1.0 — initial taxonomy"
                  autoFocus
                />
              </div>
              <div className="version-form-field">
                <label htmlFor="ver-desc">Description</label>
                <textarea
                  id="ver-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What changed? Why does this version exist?"
                />
              </div>
            </div>
            <div className="row">
              <button
                className="btn btn-primary"
                onClick={commit}
                disabled={!label.trim() || createSnapshot.isPending}
              >
                {createSnapshot.isPending ? 'Committing…' : 'Commit'}
              </button>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            {createSnapshot.isError && (
              <p className="version-error">
                Could not commit — this project may not support disk storage.
              </p>
            )}
          </div>
        )}

        {snapshots.length === 0 ? (
          <div className="version-empty">
            <p className="muted">No versions committed yet.</p>
            <p className="muted">
              Click <strong>Commit version</strong> to save a named checkpoint.
              Then <strong>Ship</strong> it to mark it as the current release.
            </p>
          </div>
        ) : (
          <>
            <div className="version-lifecycle-hint">
              <span className="hint-item"><span className="hint-dot" style={{ background: STATUS_LABEL.draft.color }} /> Draft — committed, not yet shipped</span>
              <span className="hint-item"><span className="hint-dot" style={{ background: STATUS_LABEL.released.color }} /> Released — current live version</span>
              <span className="hint-item"><span className="hint-dot" style={{ background: STATUS_LABEL.deprecated.color }} /> Deprecated — superseded by a newer release</span>
            </div>
            <ol className="version-timeline">
              {snapshots.map((snap, i) => (
                <VersionCard
                  key={snap.id}
                  snap={snap}
                  isLatest={i === 0}
                  projectId={projectId}
                  onRestore={restore}
                  onShip={ship}
                  isRestoring={restoreSnapshot.isPending && restoreSnapshot.variables === snap.id}
                  isShipping={shipSnapshot.isPending && shipSnapshot.variables === snap.id}
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function VersionCard({
  snap,
  isLatest,
  projectId,
  onRestore,
  onShip,
  isRestoring,
  isShipping,
}: {
  snap: Snapshot;
  isLatest: boolean;
  projectId: string;
  onRestore: (s: Snapshot) => void;
  onShip: (s: Snapshot) => void;
  isRestoring: boolean;
  isShipping: boolean;
}) {
  const date = new Date(snap.created);
  const dateStr = date.toLocaleString([], {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const statusMeta = STATUS_LABEL[snap.status] ?? STATUS_LABEL.draft;

  return (
    <li className={`version-card version-card-${snap.status}${isLatest ? ' version-card-latest' : ''}`}>
      <div className="version-card-dot" style={{ background: statusMeta.color }} />
      <div className="version-card-body">
        <div className="version-card-header">
          <span className="version-card-label">
            {snap.label}
            <span className="version-badge" style={{ background: statusMeta.color }}>
              {statusMeta.label}
            </span>
          </span>
          <time className="version-card-time">{dateStr}</time>
        </div>
        {snap.description && <p className="version-card-desc">{snap.description}</p>}
        <div className="version-card-meta">
          <span>{snap.node_count} nodes</span>
          <span>·</span>
          <span>{snap.edge_count} edges</span>
        </div>
        <div className="version-card-actions">
          <a
            href={`http://localhost:8000/api/snapshots/${snap.id}/ttl?project_id=${projectId}`}
            download={`${snap.label.replace(/[^a-z0-9]/gi, '-')}.ttl`}
            className="btn btn-sm"
          >
            Download TTL
          </a>
          <button
            className="btn btn-sm"
            title="Compare this snapshot to the current live graph"
            onClick={() => {
              document.dispatchEvent(new CustomEvent('weave:diff-requested', {
                detail: { snapshotId: snap.id },
              }));
              document.dispatchEvent(new CustomEvent('weave:switch-tab', {
                detail: { tab: 'Graph' },
              }));
            }}
          >
            Diff vs live
          </button>
          {snap.status !== 'released' && (
            <button
              className="btn btn-sm btn-success"
              title="Ship this version — marks it as released, deprecates the previous release"
              onClick={() => onShip(snap)}
              disabled={isShipping}
            >
              {isShipping ? 'Shipping…' : '🚀 Ship'}
            </button>
          )}
          {snap.status !== 'released' && (
            <button
              className="btn btn-sm"
              onClick={() => onRestore(snap)}
              disabled={isRestoring}
              title="Restore this snapshot to the live graph"
            >
              {isRestoring ? 'Restoring…' : 'Restore'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

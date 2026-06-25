import LoadingSpinner from '../components/LoadingSpinner';
import { useHistory } from '../hooks/queries';
import type { HistoryEvent } from '../types';

interface Props {
  projectId: string;
}

const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  user: { label: 'Human', color: '#2563eb' },
  llm: { label: 'AI', color: '#7c3aed' },
};

/** Audit trail: every applied mutation, newest first. */
export default function HistoryView({ projectId }: Props) {
  const { data: events = [], isLoading, isError } = useHistory(projectId);

  if (isLoading) return <LoadingSpinner message="Loading history…" />;
  if (isError) return <div className="center-state">Could not load history.</div>;

  return (
    <div className="view">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>History</h2>
            <p className="muted">
              Every applied change to this ontology — who made it, when, and what changed.
            </p>
          </div>
          <span className="history-count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>

        {events.length === 0 ? (
          <p className="muted">No changes recorded yet. Use the AI bar or forms to edit the graph.</p>
        ) : (
          <ol className="history-timeline">
            {events.map((event) => (
              <HistoryEventCard key={event.id} event={event} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function HistoryEventCard({ event }: { event: HistoryEvent }) {
  const agent = AGENT_LABELS[event.agent] ?? { label: event.agent, color: '#64748b' };
  const date = new Date(event.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <li className="history-event">
      <div className="history-event-dot" style={{ background: agent.color }} />
      <div className="history-event-body">
        <div className="history-event-header">
          <span className="history-agent-badge" style={{ color: agent.color }}>
            {agent.label}
          </span>
          <span className="history-event-summary">{event.summary}</span>
          <time className="history-event-time" title={date.toISOString()}>
            {timeStr} · {dateStr}
          </time>
        </div>
        {event.operations.length > 0 && (
          <ul className="history-ops">
            {event.operations.map((op, i) => (
              <li key={i} className="history-op">
                <span className={`history-op-badge history-op-${op.op}`}>{op.op}</span>
                {op.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

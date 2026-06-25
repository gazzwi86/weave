import { useState, useEffect } from 'react';
import { KIND_COLORS } from '../lib/colors';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'weave:onboarded';

const KIND_LABELS: [string, string][] = [
  ['BusinessDomain', 'Business Domain'],
  ['BusinessCapability', 'Business Capability'],
  ['System', 'System'],
  ['Service', 'Service'],
  ['DataAsset', 'Data Asset'],
  ['Field', 'Field'],
  ['Concept', 'Concept'],
  ['Class', 'Class'],
];

const FEATURES = [
  { icon: '🗺️', title: 'Explore canvas', desc: 'Force-directed graph, colour-coded by kind, searchable and filterable.' },
  { icon: '🤖', title: 'AI editing', desc: 'Describe changes in plain English — Claude proposes, you review and approve.' },
  { icon: '⚡', title: 'Capabilities', desc: 'Heat-mapped business capability mapping across domains and systems.' },
  { icon: '🔍', title: 'Query', desc: 'Ask the graph with SPARQL or natural language.' },
  { icon: '📤', title: 'Export', desc: 'Download your ontology as TTL, CSV, or Markdown.' },
  { icon: '✅', title: 'Rules', desc: 'Define SHACL validation constraints to keep your graph consistent.' },
];

const DEMO_TASKS = [
  'Click any node on the Explore canvas to inspect it',
  'Edit a node — change its label or kind using the Inspector panel',
  "Type a question in the AI bar below the canvas, e.g. 'Add a new service called Auth API'",
  'Open the Capabilities tab and explore the business capability map',
  'Open the Query tab and run a SPARQL query',
];

export default function OnboardingModal({ open, onClose }: Props) {
  const [firstRun, setFirstRun] = useState(() => !localStorage.getItem(STORAGE_KEY));
  const [slide, setSlide] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(() => Array(DEMO_TASKS.length).fill(false));

  // When opened via the HelpButton (open=true), jump to the features slide.
  useEffect(() => {
    if (open) setSlide(1);
  }, [open]);

  const visible = open || firstRun;

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setFirstRun(false);
    onClose();
  }

  function toggleTask(i: number) {
    setChecked((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  const allDone = checked.every(Boolean);

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Welcome to Weave">
      <div className="onboarding-modal">
        {/* Close button always present */}
        <button className="onboarding-close" onClick={dismiss} aria-label="Close">
          ✕
        </button>

        {/* Slide 1 — Welcome */}
        {slide === 0 && (
          <div className="onboarding-slide">
            <div className="onboarding-slide-title">Welcome to Weave</div>
            <p className="onboarding-slide-body">
              Build, curate and visualise knowledge graphs as rich interactive ontologies. Connect
              concepts, systems, capabilities and data on open semantic-web standards.
            </p>
            <div className="onboarding-kind-chips">
              {KIND_LABELS.map(([key, label]) => (
                <span key={key} className="chip onboarding-kind-chip">
                  <span
                    className="chip-dot"
                    style={{ background: KIND_COLORS[key] ?? '#64748b' }}
                  />
                  {label}
                </span>
              ))}
            </div>
            <div className="onboarding-footer">
              <button className="btn btn-primary" onClick={() => setSlide(1)}>
                Show me around →
              </button>
            </div>
          </div>
        )}

        {/* Slide 2 — Feature overview */}
        {slide === 1 && (
          <div className="onboarding-slide">
            <div className="onboarding-slide-title">Key features</div>
            <div className="onboarding-feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="onboarding-feature-card">
                  <span className="onboarding-feature-icon">{f.icon}</span>
                  <div>
                    <div className="onboarding-feature-title">{f.title}</div>
                    <div className="onboarding-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="onboarding-footer">
              <button className="btn" onClick={dismiss}>
                Skip for now
              </button>
              <button className="btn btn-primary" onClick={() => setSlide(2)}>
                Start with demo tasks →
              </button>
            </div>
          </div>
        )}

        {/* Slide 3 — Demo tasks */}
        {slide === 2 && (
          <div className="onboarding-slide">
            <div className="onboarding-slide-title">Try these to get started</div>
            <p className="onboarding-slide-body">
              Work through these tasks at your own pace — tick each one as you go.
            </p>
            <ul className="onboarding-tasks">
              {DEMO_TASKS.map((task, i) => (
                <li key={i} className="onboarding-task-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => toggleTask(i)}
                    />
                    <span className={checked[i] ? 'onboarding-task-done' : ''}>{task}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="onboarding-footer">
              {allDone ? (
                <button className="btn btn-primary" onClick={dismiss}>
                  You're ready! Close
                </button>
              ) : (
                <button className="btn" onClick={dismiss}>
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

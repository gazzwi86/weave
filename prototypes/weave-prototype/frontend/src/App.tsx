import { lazy, Suspense, useEffect, useState } from 'react';
import { useProjects } from './hooks/queries';
import ProjectSwitcher from './components/ProjectSwitcher';
import OnboardingModal from './components/OnboardingModal';
import HelpButton from './components/HelpButton';
import LoadingSpinner from './components/LoadingSpinner';

// Heavy canvas views are lazy-loaded so their libraries (Cytoscape, React Flow)
// land in separate chunks and don't block the initial paint.
const GraphView = lazy(() => import('./views/ExploreView'));
const DomainView = lazy(() => import('./views/DomainView'));
const CapabilityView = lazy(() => import('./views/CapabilityView'));
const ObjectsView = lazy(() => import('./views/ObjectsView'));
const GlossaryView = lazy(() => import('./views/GlossaryView'));
const InventoryView = lazy(() => import('./views/InventoryView'));
const RulesView = lazy(() => import('./views/RulesView'));
const QueryView = lazy(() => import('./views/QueryView'));
const HistoryView = lazy(() => import('./views/HistoryView'));
const VersionsView = lazy(() => import('./views/VersionsView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

// Query is first (power-user entry point), Graph second (primary canvas)
const TABS = [
  'Query', 'Graph', 'Domain', 'Capabilities', 'Objects',
  'Glossary', 'Inventory', 'Rules', 'History', 'Versions', 'Settings',
] as const;
type Tab = (typeof TABS)[number];

const PROJECT_TABS = new Set<Tab>([
  'Query', 'Graph', 'Domain', 'Capabilities', 'Objects', 'Glossary', 'Inventory', 'History', 'Versions',
]);

const DEFAULT_PROJECT = 'demo';

export default function App() {
  const [tab, setTab] = useState<Tab>('Graph');
  const [projectId, setProjectId] = useState<string>(DEFAULT_PROJECT);
  const [showHelp, setShowHelp] = useState(false);
  const { data: projects } = useProjects();

  useEffect(() => {
    if (!projects || projects.length === 0) return;
    if (!projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  // Allow views to programmatically switch tabs (e.g. Versions → Graph for diff).
  useEffect(() => {
    const onSwitch = (e: Event) => {
      const { tab: t } = (e as CustomEvent).detail as { tab: Tab };
      if (TABS.includes(t)) setTab(t);
    };
    document.addEventListener('weave:switch-tab', onSwitch);
    return () => document.removeEventListener('weave:switch-tab', onSwitch);
  }, []);

  const viewKey = PROJECT_TABS.has(tab) ? projectId + tab : tab;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/weave.svg" alt="" />
          <span className="brand-accent">Weave</span>
        </div>
        <ProjectSwitcher activeId={projectId} onSelect={setProjectId} />
        <div className="topbar-spacer" />
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="body">
        <Suspense fallback={<LoadingSpinner message="Loading view…" />}>
          <ActiveView key={viewKey} tab={tab} projectId={projectId} />
        </Suspense>
      </main>
      <OnboardingModal open={showHelp} onClose={() => setShowHelp(false)} />
      <HelpButton onClick={() => setShowHelp(true)} />
    </div>
  );
}

function ActiveView({ tab, projectId }: { tab: Tab; projectId: string }) {
  switch (tab) {
    case 'Query':
      return <QueryView projectId={projectId} />;
    case 'Graph':
      return <GraphView projectId={projectId} />;
    case 'Domain':
      return <DomainView projectId={projectId} />;
    case 'Capabilities':
      return <CapabilityView projectId={projectId} />;
    case 'Objects':
      return <ObjectsView projectId={projectId} />;
    case 'Glossary':
      return <GlossaryView projectId={projectId} />;
    case 'Inventory':
      return <InventoryView projectId={projectId} />;
    case 'Rules':
      return <RulesView projectId={projectId} />;
    case 'History':
      return <HistoryView projectId={projectId} />;
    case 'Versions':
      return <VersionsView projectId={projectId} />;
    case 'Settings':
      return <SettingsView projectId={projectId} />;
  }
}

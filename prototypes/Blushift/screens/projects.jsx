/* global React, Icon, Avatar, Btn, Bar, FIXTURES */
const { useState: uS_pj } = React;

const ProjectsScreen = ({ navigate }) => {
  const [filter, setFilter] = uS_pj('All');
  const projects = FIXTURES.projects;
  const filters = ['All', 'In flight', 'Spec review', 'Blocked', 'Recent'];

  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="All work in flight"
        icon="cube"
        title="Projects"
        subtitle={`${projects.length} active · across ${FIXTURES.org.domains} domains`}
        role="The project register. Every approved Snappy spec becomes a project tracked here from kickoff through demo and decommission."
        purpose="Pick a project to open its dashboard, board, console, or replan view. Filter by phase, owner, or domain to find what needs attention."
        contributes="The execution layer of the Blushift pipeline: Snappy proposes → Change Mgmt sequences → Projects runs and demos."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Filter</Btn>
          <Btn icon="sparkle" onClick={() => navigate('/snappy')}>New Snappy Request</Btn>
        </>}
      />

      <div style={{ display:'flex', gap: 6, marginBottom: 14 }}>
        {filters.map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
        {projects.map(p => (
          <div key={p.id} className="card clickable" style={{ padding: 16, cursor:'pointer' }}
               onClick={() => navigate(`/project/${p.id}/dashboard`)}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  <span className="chip">{p.stack}</span>
                  <span className="chip blue">{p.phase}</span>
                </div>
              </div>
              <Avatar name={p.owner.name} initials={p.owner.initials} size={26}/>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color:'var(--text-mute)', display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
                <span>Phase progress</span>
                <span className="mono">{p.phasePct}%</span>
              </div>
              <Bar value={p.phasePct} max={100}/>
            </div>
            <div style={{ marginTop: 12, display:'flex', justifyContent:'space-between', fontSize: 11.5, color:'var(--text-dim)' }}>
              <span><span className={`dot ${p.demo.status === 'green' ? 'green' : 'amber'}`}/> {p.demo.label}</span>
              <span className="mono">${p.budget.used.toLocaleString()} / ${p.budget.cap.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 10, display:'flex', gap: 6 }}>
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/project/${p.id}/dashboard`); }}>Dashboard</Btn>
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/project/${p.id}/kanban`); }}>Board</Btn>
              <Btn size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/project/${p.id}/replan`); }}>Replan</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.ProjectsScreen = ProjectsScreen;

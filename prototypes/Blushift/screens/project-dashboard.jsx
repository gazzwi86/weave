/* global React, Icon, Avatar, Sparkline, Bar, Btn, StatusDot, FIXTURES, fmt, SubNav, PhaseBar */

const { useState: uS_pd } = React;

const PROJECT_SUBNAV = [
  { id: 'dashboard', label: 'Project Dashboard' },
  { id: 'kanban',    label: 'Kanban' },
  { id: 'specs',     label: 'Specs' },
  { id: 'console',   label: 'Console' },
  { id: 'replan',    label: 'Replan' },
];

const ProjectShell = ({ projectId, view, navigate, children }) => {
  const project = FIXTURES.projects.find(p => p.id === projectId) || FIXTURES.projects[0];
  return (
    <>
      <SubNav
        items={PROJECT_SUBNAV}
        active={view}
        onPick={(id) => navigate(`/project/${project.id}/${id}`)}
        right={
          <div style={{ display:'flex', alignItems:'center', gap: 10, paddingRight: 4 }}>
            <span className="chip">{project.stack}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{project.phase}</span>
            <Avatar name={project.owner.name} initials={project.owner.initials} size={20}/>
          </div>
        }
      />
      {children({ project })}
    </>
  );
};

const Tile = ({ title, children, style }) => (
  <div className="card" style={{ padding: 16, ...style }}>
    <div className="h-eyebrow" style={{ marginBottom: 10 }}>{title}</div>
    {children}
  </div>
);

const ProjectDashboard = ({ project, navigate }) => {
  const [planOpen, setPlanOpen] = uS_pd(false);
  const stripShots = [
    { lbl: 'TASK-018 cart drawer', tone: '#1E3A8A' },
    { lbl: 'TASK-022 promo flow',   tone: '#0E7490' },
    { lbl: 'TASK-021 sidebar',      tone: '#7C3AED' },
  ];
  const tasks = FIXTURES.tasks.inFlight;
  return (
    <div className="page-enter" style={{ padding: '20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 18, gap: 12 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Project</div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing:'-0.01em' }}>{project.name}</h1>
            <span className="chip blue">Wave 1</span>
            <span className="chip">{project.stack}</span>
          </div>
          <div style={{ marginTop: 8, display:'flex', alignItems:'center', gap: 10 }}>
            <PhaseBar pct={project.phasePct} label={project.phase}/>
            <span style={{ fontSize: 11.5, color:'var(--text-mute)' }}>· Owner</span>
            <Avatar name={project.owner.name} initials={project.owner.initials} size={18}/>
            <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{project.owner.name}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Btn icon="play" size="sm">Run demo</Btn>
          <Btn icon="branch" size="sm" onClick={() => navigate(`/project/${project.id}/replan`)}>Replan</Btn>
          <Btn icon="rocket" size="sm" onClick={() => setPlanOpen(true)}>Plan release</Btn>
          <Btn icon="kanban" size="sm" onClick={() => navigate(`/project/${project.id}/kanban`)}>Open Kanban</Btn>
          <Btn icon="sparkle" variant="primary" size="sm" onClick={() => navigate(`/snappy?project=${project.id}`)}>Start with Snappy</Btn>
        </div>
      </div>

      {/* Three big tiles */}
      <div style={{ display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Tile title="Demo readiness">
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <StatusDot kind="green"/>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Green</div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4 }}>Last demo: 2 hours ago</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 6, marginTop: 12 }}>
            {stripShots.map((s,i) => (
              <div key={i} style={{
                aspectRatio: '16/10',
                background: `linear-gradient(135deg, ${s.tone}, #0A0E14)`,
                border: '1px solid var(--line)',
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position:'absolute', top: 4, left: 5, fontSize: 9, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.7)' }}>{s.lbl}</div>
                {/* fake UI lines */}
                <div style={{ position:'absolute', bottom: 6, left: 6, right: 6, display:'flex', flexDirection:'column', gap: 2 }}>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 1, width: '70%' }}/>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 1, width: '90%' }}/>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 1, width: '50%' }}/>
                </div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile title="Budget">
          <div style={{ display:'flex', alignItems:'baseline', gap: 6 }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>$1,847</span>
            <span style={{ color: 'var(--text-mute)', fontSize: 13 }}>/ $3,000</span>
            <span style={{ marginLeft:'auto', fontSize: 12, color: 'var(--text-dim)' }}>62%</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <Bar value={62} max={100}/>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-mute)' }}>Tokens by agent</div>
          <div style={{ display:'flex', height: 6, borderRadius: 3, overflow:'hidden', marginTop: 4, background: 'var(--line)' }}>
            <div style={{ width: '41%', background: '#3B82F6' }}/>
            <div style={{ width: '28%', background: '#22D3EE' }}/>
            <div style={{ width: '18%', background: '#8B5CF6' }}/>
            <div style={{ width: '8%',  background: '#10B981' }}/>
            <div style={{ width: '5%',  background: '#F59E0B' }}/>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap: 10, marginTop: 8, fontSize: 11 }}>
            {[
              { l:'Engineer 41%', c:'#3B82F6' },
              { l:'QA 28%',       c:'#22D3EE' },
              { l:'Architect 18%',c:'#8B5CF6' },
              { l:'Polaris 8%',   c:'#10B981' },
              { l:'Other 5%',     c:'#F59E0B' },
            ].map((s,i) => (
              <span key={i} style={{ display:'flex', alignItems:'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: s.c }}/>
                <span style={{ color:'var(--text-dim)' }}>{s.l}</span>
              </span>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-mute)' }}>
            Pre-flight estimate vs actual: <span className="mono" style={{ color:'var(--green)' }}>×1.04</span> (within ±20% target)
          </div>
        </Tile>

        <Tile title="Forecast confidence">
          <div style={{ fontSize: 16, fontWeight: 500 }}>Phase complete in <span style={{ color:'var(--blue-bright)' }}>3 days</span> <span style={{ color:'var(--text-mute)' }}>± 1 day</span></div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-dim)' }}>Cycle time per task — last 30</div>
          <div style={{ marginTop: 10 }}>
            <Sparkline data={[3.2,3.0,2.9,2.8,2.6,2.6,2.4,2.5,2.3,2.2,2.4,2.3,2.2,2.0,2.1,1.9,2.0,1.8,1.9,1.8]} width={300} height={48} color="#60A5FA"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
            {[
              { l:'Velocity', v:'4.1 / day' },
              { l:'WIP',       v:'7 tasks' },
              { l:'Defect rate', v:'2.4%' },
            ].map((s,i) => (
              <div key={i}>
                <div style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{s.l}</div>
                <div className="mono" style={{ fontSize: 13, marginTop: 2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        </Tile>
      </div>

      {/* two columns */}
      <div style={{ display:'grid', gridTemplateColumns: '1fr 380px', gap: 16, marginBottom: 16 }}>
        <Tile title="Tasks in flight">
          <div style={{ display:'flex', flexDirection:'column' }}>
            {tasks.map((t, i) => (
              <div key={t.id}
                onClick={() => navigate(`/project/${project.id}/kanban?task=${t.id}`)}
                className="row-hover"
                style={{
                  display:'grid',
                  gridTemplateColumns: '12px 100px 1fr auto auto',
                  gap: 12, padding: '10px 8px',
                  borderTop: i>0 ? '1px solid var(--line-soft)' : 'none',
                  cursor: 'pointer',
                  alignItems:'center',
                  ...(t.highlight ? { background: 'rgba(59,130,246,0.04)' } : {}),
                }}>
                <span className={`dot ${t.state === 'retry' ? 'amber' : t.state === 'qa' ? 'blue' : t.state === 'review' ? 'purple' : 'green'}`}/>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t.id}</span>
                <span style={{ fontSize: 13 }}>{t.title}</span>
                <span className="chip">{t.agent}</span>
                <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>{t.meta}</span>
              </div>
            ))}
          </div>
        </Tile>
        <Tile title="Active Polaris proposals">
          <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
            <div style={{
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.05)',
              borderRadius: 5, padding: 10,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 4 }}>
                <Icon name="sparkle" size={11} style={{ color: 'var(--purple)' }}/>
                <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>P-2026-05-08-014</span>
                <span className="chip purple" style={{ marginLeft:'auto' }}>HIGH</span>
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 8 }}>Add font preconnect to onboarding-flow &lt;head&gt; — reduces FOUT</div>
              <Btn size="sm" icon="bolt-fill" variant="primary" style={{ width:'100%' }}>Dispatch</Btn>
            </div>
            <div style={{
              border: '1px solid var(--line)', borderRadius: 5, padding: 10,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <div>
                <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>P-2026-05-07-022</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>Cache /api/portfolio at edge</div>
              </div>
              <Icon name="chevron-right" size={14} style={{ color: 'var(--text-mute)' }}/>
            </div>
          </div>
        </Tile>
      </div>

      {/* Blockers + escalations */}
      <Tile title="Blockers & escalations" style={{ marginBottom: 16 }}>
        <div style={{
          display:'grid', gridTemplateColumns: '32px 1fr auto',
          gap: 12, padding: '4px 0',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.3)', display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--amber)' }}>
            <Icon name="alert" size={14}/>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              <span className="mono">TASK-024</span> — Engineer stuck after 3 retries
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              Suggested human action: <span style={{ color: 'var(--text)' }}>Review the Playwright trace; the font-loaded assertion is failing because the preconnect link is missing in onboarding-flow. Either dispatch P-2026-05-08-014 to add it, or relax the threshold for this task with an ADR.</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 6, alignItems:'flex-end' }}>
            <Btn size="sm" icon="sparkle" onClick={() => navigate('/help-me')}>Help me</Btn>
            <Btn size="sm" variant="ghost">Mute</Btn>
          </div>
        </div>
      </Tile>

      {/* Git ribbon */}
      <Tile title="Recent commits">
        <div style={{ display:'flex', alignItems:'center', gap: 0, padding: '4px 0' }}>
          {[
            { h:'a1b2c3d', m:'feat(checkout): summary line items', who:'Engineer agent', t:'4m', state:'green' },
            { h:'b3d4e5f', m:'fix(intl): currency formatting nbsp',  who:'Engineer agent', t:'42m', state:'green' },
            { h:'c5e6f7g', m:'refactor(promo): split validators',     who:'Engineer agent', t:'1h', state:'green' },
            { h:'d6f7g8h', m:'test(checkout): visual baseline',       who:'QA agent',       t:'2h', state:'amber' },
            { h:'e7g8h9i', m:'chore: bump @company/tokens to 4.2.1',  who:'Engineer agent', t:'3h', state:'green' },
          ].map((c,i,arr) => (
            <div key={i} style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', minWidth: 0 }}>
              {i < arr.length - 1 && <div style={{ position:'absolute', top: 8, left:'50%', right:'-50%', height: 1, background: 'var(--line-strong)' }}/>}
              <div style={{ width: 14, height: 14, borderRadius: 7, background: 'var(--bg)', border: `2px solid ${c.state === 'green' ? 'var(--green)' : 'var(--amber)'}`, position:'relative', zIndex: 1 }}/>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--blue-bright)', marginTop: 6 }}>{c.h}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, textAlign:'center', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{c.m}</div>
              <div style={{ fontSize: 10, color: 'var(--text-mute)', marginTop: 2 }}>{c.t}</div>
            </div>
          ))}
        </div>
      </Tile>
      {planOpen && window.PlanReleaseModal && (
        <window.PlanReleaseModal onClose={() => setPlanOpen(false)} navigate={navigate} project={project}/>
      )}
    </div>
  );
};

window.PROJECT_SUBNAV = PROJECT_SUBNAV;
window.ProjectShell = ProjectShell;
window.ProjectDashboard = ProjectDashboard;

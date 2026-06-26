/* global React, Icon, Btn, Avatar, Bar, Sparkline, Pill, FIXTURES, fmt */
const { useState: uS_wd, useMemo: uM_wd } = React;

const WORKSPACE_SUBNAV = [
  { id:'overview', label:'Overview' },
  { id:'projects', label:'Projects' },
  { id:'specs',    label:'Specs' },
  { id:'ops',      label:'Ops' },
  { id:'wiki',     label:'Wiki' },
  { id:'polaris',  label:'Enhancements' },
  { id:'settings', label:'Settings' },
];

const WorkspaceDetail = ({ workspaceId, view='overview', navigate }) => {
  const w = (FIXTURES.workspaces || []).find(x => x.id === workspaceId) || FIXTURES.workspaces[0];
  const projects = (FIXTURES.projects || []).filter(p => p.workspace === w.id);

  return (
    <div className="page-enter">
      <window.SubNav
        items={WORKSPACE_SUBNAV}
        active={view}
        onPick={(id) => navigate(`/workspace/${w.id}/${id}`)}
        right={
          <div style={{ display:'flex', alignItems:'center', gap: 10, paddingRight: 6 }}>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>led by</span>
            <Avatar name={w.lead.name} size={20}/>
            <span style={{ fontSize: 12 }}>{w.lead.name}</span>
            <Btn icon="sparkle" size="sm" onClick={() => navigate('/snappy')}>New Snappy</Btn>
          </div>
        }
      />

      <div style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
        <WSHeader w={w}/>

        {view === 'overview' && <Overview w={w} projects={projects} navigate={navigate}/>}
        {view === 'projects' && <ProjectsTab w={w} projects={projects} navigate={navigate}/>}
        {view === 'specs'    && <SpecsTab w={w} navigate={navigate}/>}
        {view === 'ops'      && window.WorkspaceOpsScreen && <window.WorkspaceOpsScreen w={w} navigate={navigate}/>}
        {view === 'wiki'     && <WikiTab w={w} navigate={navigate}/>}
        {view === 'polaris'  && <DiscoveryTab w={w} navigate={navigate}/>}
        {view === 'settings' && window.WorkspaceSettings && <window.WorkspaceSettings w={w} navigate={navigate}/>}
      </div>
    </div>
  );
};

const WSHeader = ({ w }) => (
  <div style={{ display:'flex', alignItems:'center', gap: 16, marginBottom: 22 }}>
    <window.WSGlyph w={w} size={56}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="h-eyebrow">Workspace</div>
      <h1 style={{ margin: '4px 0 4px', fontSize: 24, fontWeight: 600, letterSpacing:'-0.01em' }}>{w.name}</h1>
      <div style={{ fontSize: 13, color:'var(--text-dim)' }}>{w.description}</div>
    </div>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 6 }}>
      <window.HealthDot health={w.health}/>
      <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{w.lastActive}</span>
    </div>
  </div>
);

const Overview = ({ w, projects, navigate }) => (
  <>
    <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap: 16, marginBottom: 22 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Active projects ({projects.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {projects.length === 0 && <div style={{ fontSize: 12, color:'var(--text-mute)', padding: 20, textAlign:'center' }}>No projects yet — kick one off with a Snappy Request.</div>}
          {projects.map(p => (
            <div key={p.id} className="row-hover" onClick={() => navigate(`/project/${p.id}/dashboard`)}
              style={{ padding:'10px 12px', display:'grid', gridTemplateColumns:'1fr 200px 100px 80px 30px', gap: 10, alignItems:'center', borderRadius: 6, cursor:'pointer', border:'1px solid var(--line-soft)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.stack}</div>
              </div>
              <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{p.phase}</div>
              <div style={{ width: 80 }}><Bar value={p.phasePct} max={100}/></div>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{fmt.pct(p.budget.used, p.budget.cap)} budget</span>
              <Icon name="chevron-right" size={12} style={{ color:'var(--text-mute)' }}/>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Team</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
          {w.contributors.map((c, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap: 10 }}>
              <Avatar name={c.n} initials={c.i} size={26}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5 }}>{c.n}</div>
                <div style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{i === 0 ? 'Workspace lead' : (i === 1 ? 'Architect' : (i % 2 === 0 ? 'Engineer' : 'Reviewer'))}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Recent activity</div>
        {[
          { who:'Engineer agent', what:'committed', tgt:'src/portal/checkout.tsx', t:'4m ago' },
          { who:'Tech-Writer',    what:'updated wiki', tgt:'/customer-portal/identity-svc', t:'1h ago' },
          { who:'Polaris',        what:'opened proposal', tgt:'PL-2026-05-08-014', t:'4h ago' },
          { who: w.lead.name,     what:'approved phase gate', tgt:'Wave 1 kick-off', t:'6h ago' },
          { who:'Critic agent',   what:'requested changes on', tgt:'spec/csp-v2-checkout', t:'8h ago' },
        ].map((a, i) => (
          <div key={i} style={{ padding:'8px 0', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'1fr auto', gap: 10, alignItems:'center' }}>
            <div style={{ fontSize: 12.5 }}>
              <span style={{ color:'var(--blue-bright)' }}>{a.who}</span>
              <span style={{ color:'var(--text-dim)' }}> {a.what} </span>
              <span className="mono" style={{ fontSize: 11.5, color:'var(--text)' }}>{a.tgt}</span>
            </div>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{a.t}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>This workspace owns</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6, marginBottom: 14 }}>
          {['portal-bff','identity-svc','profile-svc','consent-svc','session-svc','onboarding-svc','prefs-svc','notif-svc'].map(s => (
            <span key={s} className="chip mono" style={{ fontSize: 11 }}>{s}</span>
          ))}
        </div>
        <div className="h-eyebrow" style={{ marginBottom: 6 }}>Datasets</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
          <span className="chip mono" style={{ fontSize: 11, background:'var(--red-bg)', borderColor:'rgba(239,68,68,0.4)', color:'#FCA5A5' }}>customer-pii (restricted)</span>
          <span className="chip mono" style={{ fontSize: 11 }}>session-store</span>
          <span className="chip mono" style={{ fontSize: 11 }}>consent-events</span>
        </div>
      </div>
    </div>
  </>
);

const ProjectsTab = ({ w, projects, navigate }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr 200px 140px 100px 110px 110px', gap: 10, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
      <span>Project</span><span>Phase</span><span>Progress</span><span>Owner</span><span>Budget</span><span>Demo</span>
    </div>
    {projects.map((p, i) => (
      <div key={p.id} className="row-hover" onClick={() => navigate(`/project/${p.id}/dashboard`)}
        style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'1fr 200px 140px 100px 110px 110px', gap: 10, alignItems:'center', cursor:'pointer' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
          <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.stack}</div>
        </div>
        <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{p.phase}</span>
        <div style={{ width: 120 }}><Bar value={p.phasePct} max={100}/></div>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <Avatar name={p.owner.name} initials={p.owner.initials} size={20}/>
        </div>
        <span className="mono" style={{ fontSize: 11.5 }}>{fmt.money(p.budget.used)}/{fmt.money(p.budget.cap)}</span>
        <span style={{ fontSize: 11, color: p.demo.status === 'green' ? 'var(--green)' : 'var(--amber)' }}>● {p.demo.label}</span>
      </div>
    ))}
    <div style={{ padding: 14, borderTop:'1px solid var(--line-soft)', textAlign:'center' }}>
      <Btn icon="plus" variant="ghost" size="sm" onClick={() => navigate('/snappy')}>Start a new project</Btn>
    </div>
  </div>
);

const WS_SPECS = [
  { id:'SPEC-2026-018', title:'Promo code engine — multi-tier stacking', state:'In review', stage:'critic', author:'Spec Agent', updated:'1h ago', signals:['HITL pending','Critic OK'], lines: 412 },
  { id:'SPEC-2026-014', title:'Consent timestamp persistence rewrite',   state:'Approved',  stage:'merged', author:'Spec Agent', updated:'2d ago', signals:['Approved'], lines: 218 },
  { id:'SPEC-2026-011', title:'Session migration to Redis cluster',      state:'Drafting',  stage:'spec',   author:'Spec Agent', updated:'4h ago', signals:['Drafting','3 ADRs cited'], lines: 178 },
  { id:'SPEC-2026-009', title:'Address autocomplete with fallback',      state:'Approved',  stage:'merged', author:'Spec Agent', updated:'5d ago', signals:['Approved'], lines: 142 },
  { id:'SPEC-2026-007', title:'Apple Pay integration spike',             state:'Rejected',  stage:'rejected',author:'Spec Agent', updated:'1w ago', signals:['Out of scope'], lines: 89 },
  { id:'SPEC-2026-004', title:'Identity SSO upgrade to OIDC',            state:'Approved',  stage:'merged', author:'Spec Agent', updated:'2w ago', signals:['Approved','Implemented'], lines: 320 },
  { id:'SPEC-2026-001', title:'Profile management refactor',             state:'Approved',  stage:'merged', author:'Spec Agent', updated:'3w ago', signals:['Approved','Implemented'], lines: 256 },
];

const STATE_TONE = {
  'In review':{ bg:'var(--amber-bg)', c:'#FCD34D' },
  'Approved': { bg:'var(--green-bg)', c:'#A7F3D0' },
  'Drafting': { bg:'var(--blue-bg)',  c:'#BFDBFE' },
  'Rejected': { bg:'var(--red-bg)',   c:'#FCA5A5' },
};

const SpecsTab = ({ w, navigate }) => (
  <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
      <div style={{ display:'flex', gap: 6 }}>
        {['All','In review','Approved','Drafting','Rejected'].map(s => (
          <button key={s} className={`tab ${s==='All'?'active':''}`}>{s}</button>
        ))}
      </div>
      <Btn icon="sparkle" onClick={() => navigate('/snappy')}>New spec via Snappy</Btn>
    </div>
    <div className="card" style={{ padding: 0, overflow:'hidden' }}>
      <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'120px 1fr 110px 110px 100px 80px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
        <span>ID</span><span>Title</span><span>State</span><span>Author</span><span>Updated</span><span>Lines</span>
      </div>
      {WS_SPECS.map((s, i) => {
        const tone = STATE_TONE[s.state];
        return (
          <div key={s.id} className="row-hover" onClick={() => navigate(`/spec/${s.id}`)} style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'120px 1fr 110px 110px 100px 80px', gap: 12, alignItems:'center', cursor:'pointer' }}>
            <span className="mono" style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{s.id}</span>
            <div>
              <div style={{ fontSize: 13 }}>{s.title}</div>
              <div style={{ display:'flex', gap: 4, marginTop: 3 }}>
                {s.signals.map((sig, j) => <span key={j} className="chip" style={{ fontSize: 10 }}>{sig}</span>)}
              </div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: tone.bg, color: tone.c, justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.state}</span>
            <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{s.author}</span>
            <span style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{s.updated}</span>
            <span className="mono" style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{s.lines}</span>
          </div>
        );
      })}
    </div>
  </div>
);

const WikiTab = ({ w, navigate }) => {
  const sections = [
    { name:'Services', count: 12, items:['portal-bff','identity-svc','profile-svc','consent-svc','session-svc','onboarding-svc','prefs-svc','notif-svc','kyc-adapter','comms-svc','audit-trail-svc','telemetry-cust'] },
    { name:'Capabilities', count: 8, items:['Identity & SSO','Profile management','Consent','Self-service portal','Notifications','Onboarding','KYC','Comms'] },
    { name:'ADRs', count: 14, items:['ADR-014: Consent timestamp policy','ADR-013: Edge caching strategy','ADR-012: SSO upgrade to OIDC','ADR-011: BFF aggregation pattern','ADR-010: Session storage'] },
    { name:'Runbooks', count: 6, items:['portal-bff: high latency','identity-svc: token rotation','consent-svc: GDPR delete','onboarding-svc: KYC fallback'] },
  ];
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div className="h-eyebrow">Workspace wiki — auto-maintained by Tech-Writer</div>
        <Btn icon="doc" onClick={() => navigate('/wiki')}>Open full wiki</Btn>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 14 }}>
        {sections.map(s => (
          <div key={s.name} className="card" style={{ padding: 16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.count} pages</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
              {s.items.slice(0, 6).map(it => (
                <div key={it} className="row-hover" style={{ padding:'5px 8px', borderRadius: 4, fontSize: 12, color:'var(--text-dim)', cursor:'pointer', display:'flex', alignItems:'center', gap: 8 }}>
                  <Icon name="doc" size={11} style={{ color:'var(--text-mute)' }}/>
                  <span>{it}</span>
                </div>
              ))}
              {s.items.length > 6 && <div style={{ fontSize: 11, color:'var(--text-mute)', padding:'5px 8px' }}>+ {s.items.length - 6} more</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DiscoveryTab = ({ w, navigate }) => {
  const proposals = (FIXTURES.polaris || []).slice(0, w.openPolaris || 3);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div className="h-eyebrow">Workspace-scoped discovery — Polaris ideas grounded in {w.name}</div>
        <Btn icon="sparkle" onClick={() => navigate('/polaris')}>Cross-workspace Polaris</Btn>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
        {proposals.map(p => (
          <div key={p.id} className="card" style={{ padding: 16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap: 12, alignItems:'flex-start' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', gap: 6, marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{p.id}</span>
                  {p.tags && p.tags.map(t => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 12, color:'var(--text-dim)', lineHeight: 1.5 }}>{p.rationale}</div>
              </div>
              <Btn icon="sparkle" variant="primary">Dispatch</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

window.WorkspaceDetail = WorkspaceDetail;
window.WORKSPACE_SUBNAV = WORKSPACE_SUBNAV;

/* global React, Icon, Avatar, Btn, Bar, Pill, FIXTURES */
const { useState: uS_tx } = React;

const INITIATIVES = [
  {
    id:'lending-modernisation',
    name:'Lending data platform modernisation',
    sponsor:{ name:'Chris Okafor', initials:'CO' },
    range:'Q3 2026 → Q2 2027',
    progress: 38,
    status:'on-track',
    waves: 4, projects: 3, capabilities: 6, risks: 2,
    summary:'Replace 14 yrs of batch ETL with a streaming Snowflake ingestion + real-time loan ledger. Decommission 7 legacy services.',
    health:'green',
    workspaceIds:['lending-data','platform'],
    projectIds:['snowflake-ingest','csp-v2'],
    services:['snowflake-ingest','loan-ledger-svc','events-loan','reporting-svc'],
  },
  {
    id:'identity-unification',
    name:'Customer identity unification',
    sponsor:{ name:'Anna Lindqvist', initials:'AL' },
    range:'Q4 2026 → Q3 2027',
    progress: 12,
    status:'on-track',
    waves: 3, projects: 2, capabilities: 4, risks: 1,
    summary:'Merge 3 legacy identity stores into one OIDC-backed source of truth. Migrate portal, partner-api, and mobile.',
    health:'green',
    workspaceIds:['customer-portal','platform'],
    projectIds:['csp-v2'],
    services:['identity-svc','idp-broker','session-svc'],
  },
  {
    id:'claims-fast-track',
    name:'Claims fast-track expansion',
    sponsor:{ name:'Dimitri Volkov', initials:'DV' },
    range:'Q3 2026 → Q1 2027',
    progress: 64,
    status:'at-risk',
    waves: 3, projects: 4, capabilities: 5, risks: 4,
    summary:'Expand auto-adjudication from 18% → 40% of incoming auto claims. Includes fraud-scorer uplift, photo intake, and reserve estimation.',
    health:'amber',
    workspaceIds:['fraud-claims'],
    projectIds:['fraud-uplift'],
    services:['intake-svc','triage-svc','fraud-scorer','adjud-engine'],
  },
  {
    id:'compliance-foundations',
    name:'Compliance & audit foundations',
    sponsor:{ name:'Maya Patel', initials:'MP' },
    range:'Q2 2026 → Q4 2026',
    progress: 82,
    status:'on-track',
    waves: 2, projects: 3, capabilities: 3, risks: 0,
    summary:'Hash-chained audit trail across all agent actions, GDPR DSR automation, and SOC2 Type II evidence collection.',
    health:'green',
    workspaceIds:['platform','policy-underwriting'],
    projectIds:[],
    services:['audit-svc','consent-svc','policy-store'],
  },
];

window.INITIATIVES = INITIATIVES;

// Top-level entry. Accepts subRoute from OrganisationShell, OR initiativeId for legacy /transformations/<id>.
const TransformationsScreen = ({ subRoute, initiativeId, navigate }) => {
  // subRoute examples: [], ['new'], ['lending-modernisation'], ['lending-modernisation','overview']
  const sub = subRoute || (initiativeId ? [initiativeId] : []);
  if (sub[0] === 'new') return <NewInitiative navigate={navigate}/>;
  if (sub[0]) {
    const init = INITIATIVES.find(x => x.id === sub[0]);
    if (init) return <InitiativeDetail init={init} navigate={navigate}/>;
  }
  return <InitiativeList navigate={navigate}/>;
};

// ─────────────────────────────────────────────────────────────────────────
// LIST VIEW — additive: cards on top, then a cross-initiative master gantt.
// ─────────────────────────────────────────────────────────────────────────
const InitiativeList = ({ navigate }) => {
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="Multi-quarter programmes"
        icon="graph"
        title="Transformations"
        subtitle={`${INITIATIVES.length} active initiatives · ${INITIATIVES.reduce((s,i) => s + i.projects, 0)} contributing projects · ${INITIATIVES.reduce((s,i) => s + i.capabilities, 0)} capability uplifts`}
        role="The long-arc layer above projects. An initiative is a 6–18 month programme that bundles many projects toward a strategic outcome — modernisation, consolidation, expansion."
        purpose="Steer the long story: see which projects advance which capability, where you're at risk, what brief the next exec readout needs."
        contributes="Connects portfolio strategy to the individual Snappy Requests below. Capability gaps surfaced here become next quarter's project briefs."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Filter</Btn>
          <Btn icon="plus" variant="primary" onClick={() => navigate('/organisation/transformations/new')}>New initiative</Btn>
        </>}
      />

      {/* Initiative cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 14, marginBottom: 22 }}>
        {INITIATIVES.map(i => (
          <div key={i.id} className="card row-hover" onClick={() => navigate(`/organisation/transformations/${i.id}`)}
            style={{ padding: 18, cursor:'pointer', display:'flex', flexDirection:'column', gap: 12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', gap: 8, alignItems:'center', marginBottom: 6 }}>
                  <window.HealthDot health={i.health}/>
                  <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{i.range}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{i.name}</div>
                <div style={{ fontSize: 12, color:'var(--text-dim)', lineHeight: 1.5 }}>{i.summary}</div>
              </div>
            </div>

            <div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, marginBottom: 5 }}>
                <span className="h-eyebrow">Progress</span>
                <span className="mono" style={{ color: i.status==='at-risk' ? 'var(--amber)' : 'var(--green)' }}>{i.progress}%</span>
              </div>
              <div style={{ height: 6, background:'var(--raised)', borderRadius: 3, overflow:'hidden' }}>
                <div style={{ width:`${i.progress}%`, height:'100%', background: i.status==='at-risk' ? '#F59E0B' : '#10B981' }}/>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
              <TxStat label="Waves"        v={i.waves}/>
              <TxStat label="Projects"     v={i.projects}/>
              <TxStat label="Capabilities" v={i.capabilities}/>
              <TxStat label="Risks"        v={i.risks} tone={i.risks > 2 ? 'amber' : null}/>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>Sponsor</span>
              <Avatar name={i.sponsor.name} initials={i.sponsor.initials} size={20}/>
              <span style={{ fontSize: 12 }}>{i.sponsor.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cross-initiative master gantt */}
      <MasterGantt navigate={navigate}/>

      {/* Capability gap row */}
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <div className="h-eyebrow">Capability gap analysis — Northwind Mutual</div>
          <span style={{ fontSize: 11, color:'var(--text-mute)' }}>Wardley-style evolution. Where each capability sits today vs target.</span>
        </div>
        <CapabilityGapTable/>
      </div>
    </div>
  );
};

const TxStat = ({ label, v, tone }) => (
  <div style={{ background:'var(--raised)', border:'1px solid var(--line-soft)', borderRadius: 4, padding:'6px 8px' }}>
    <div style={{ fontSize: 9.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: tone === 'amber' ? '#FCD34D' : 'var(--text)' }}>{v}</div>
  </div>
);

const QUARTERS = ['Q3 2026','Q4 2026','Q1 2027','Q2 2027','Q3 2027'];

const MasterGantt = ({ navigate }) => {
  // Each initiative spans certain quarters, with status per quarter
  const ganttRows = [
    { id:'compliance-foundations', cells:['done','done','—','—','—'] },
    { id:'lending-modernisation',  cells:['in','in','in','done','—'] },
    { id:'claims-fast-track',      cells:['in','risk','in','—','—'] },
    { id:'identity-unification',   cells:['—','in','in','in','done'] },
  ];
  const cellTone = {
    done: { bg:'rgba(16,185,129,0.15)', bd:'#10B981', l:'Complete' },
    in:   { bg:'rgba(59,130,246,0.15)', bd:'#3B82F6', l:'In flight' },
    risk: { bg:'rgba(245,158,11,0.18)', bd:'#F59E0B', l:'At risk' },
    '—':  { bg:'transparent', bd:'var(--line-soft)', l:'' },
  };
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="h-eyebrow" style={{ marginBottom: 12 }}>Cross-initiative gantt</div>
      <div style={{ display:'grid', gridTemplateColumns: '260px repeat(5, 1fr)', gap: 4 }}>
        <div></div>
        {QUARTERS.map(q => <div key={q} style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 8px' }}>{q}</div>)}
        {ganttRows.map((r, i) => {
          const init = INITIATIVES.find(x => x.id === r.id);
          return (
            <React.Fragment key={i}>
              <div className="row-hover" onClick={() => navigate(`/organisation/transformations/${init.id}`)}
                style={{ fontSize: 12, padding: '8px 6px', color: 'var(--text)', borderTop: '1px solid var(--line-soft)', cursor:'pointer', display:'flex', alignItems:'center', gap: 8 }}>
                <window.HealthDot health={init.health}/>
                <span>{init.name}</span>
              </div>
              {r.cells.map((c, j) => {
                const t = cellTone[c];
                return (
                  <div key={j} style={{
                    height: 30, margin: '4px 2px',
                    background: t.bg,
                    border: `1px solid ${t.bd}`,
                    borderRadius: 4,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: 10.5, color: c==='—' ? 'var(--text-faint)' : 'var(--text-dim)',
                  }}>{t.l || ''}</div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display:'flex', gap: 14, fontSize: 11, color:'var(--text-mute)' }}>
        <Legend tone="#10B981" label="Complete"/>
        <Legend tone="#3B82F6" label="In flight"/>
        <Legend tone="#F59E0B" label="At risk"/>
      </div>
    </div>
  );
};

const Legend = ({ tone, label }) => (
  <span style={{ display:'inline-flex', alignItems:'center', gap: 5 }}>
    <span style={{ width: 10, height: 10, borderRadius: 2, background: tone, opacity: 0.7 }}/>
    {label}
  </span>
);

const CapabilityGapTable = () => {
  const rows = [
    { c:'Data ingestion',     t:['Custom','Product','Commodity'] },
    { c:'Decisioning',         t:['Custom','Custom','Product'] },
    { c:'Loan ledger',         t:['Genesis','Custom','Product'] },
    { c:'Reporting',           t:['Product','Product','Commodity'] },
    { c:'Self-serve analytics',t:['—','Genesis','Custom'] },
    { c:'Claims auto-adjud',   t:['Custom','Product','Product'] },
    { c:'Identity (OIDC)',     t:['Custom','Product','Commodity'] },
    { c:'Audit trail',         t:['Product','Commodity','Commodity'] },
  ];
  return (
    <table className="tbl">
      <thead>
        <tr><th>Capability</th><th>Today</th><th>+6 mo</th><th>+12 mo</th></tr>
      </thead>
      <tbody>
        {rows.map((r,i) => (
          <tr key={i}>
            <td style={{ fontWeight:500 }}>{r.c}</td>
            {r.t.map((m,j) => {
              const ix = ['—','Genesis','Custom','Product','Commodity'].indexOf(m);
              const w = ['transparent','rgba(139,92,246,0.15)','rgba(245,158,11,0.15)','rgba(59,130,246,0.15)','rgba(16,185,129,0.15)'];
              const c = ['var(--text-faint)','#DDD6FE','#FCD34D','#BFDBFE','#A7F3D0'];
              return <td key={j}><span style={{ display:'inline-block', padding:'2px 8px', background: w[ix], color: c[ix], borderRadius: 3, fontSize: 11 }}>{m}</span></td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────
const InitiativeDetail = ({ init, navigate }) => {
  const cellTone = {
    done: { bg:'rgba(16,185,129,0.15)', bd:'#10B981', l:'Complete' },
    in:   { bg:'rgba(59,130,246,0.15)', bd:'#3B82F6', l:'In flight' },
    risk: { bg:'rgba(245,158,11,0.18)', bd:'#F59E0B', l:'At risk' },
    '—':  { bg:'transparent', bd:'var(--line-soft)', l:'' },
  };
  const rows = [
    { l:'Decommission legacy ETL', cells: ['done','done','—','—'] },
    { l:'Stand up Snowflake ingestion', cells: ['in','in','done','—'] },
    { l:'Migrate decision-svc to streaming', cells: ['—','in','in','risk'] },
    { l:'Real-time loan ledger', cells: ['—','—','in','in'] },
    { l:'Retire batch reporting', cells: ['—','—','—','in'] },
    { l:'Self-serve analytics', cells: ['—','in','in','in'] },
  ];

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <div style={{ marginBottom: 14, display:'flex', alignItems:'center', gap: 8, fontSize: 12, color:'var(--text-mute)' }}>
        <span onClick={() => navigate('/organisation/transformations')} style={{ cursor:'pointer' }} className="row-hover">Transformations</span>
        <Icon name="chevron-right" size={11}/>
        <span style={{ color:'var(--text)' }}>{init.name}</span>
      </div>

      <window.PageHeader
        eyebrow={`Initiative · ${init.range}`}
        icon="graph"
        title={init.name}
        subtitle={`Sponsor: ${init.sponsor.name} · ${init.capabilities} capability uplifts · ${init.projects} contributing projects`}
        role="Multi-quarter programme view — the rollup above individual projects. Tracks capability gaps, gantt sequencing, and stakeholder briefs over 12+ months."
        purpose="Steer the long-arc story: see which projects are advancing which capabilities, where you're at risk, and what brief the next exec readout needs."
        contributes="Connects portfolio-level strategy to the individual Snappy Requests and projects underneath. Capability gaps here become next quarter's Snappy briefs."
        actions={<>
          <Btn icon="doc" variant="ghost" size="sm">Brief</Btn>
          <Btn icon="sparkle" onClick={() => navigate('/snappy')}>New project for this</Btn>
        </>}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <TxKPI label="Progress"     v={`${init.progress}%`} tone={init.status==='at-risk'?'amber':'green'}/>
        <TxKPI label="Waves"        v={`${init.waves} planned`} sub="2 in flight"/>
        <TxKPI label="Projects"     v={init.projects} sub={`${init.projects} active`}/>
        <TxKPI label="Open risks"   v={init.risks} tone={init.risks>2?'amber':null}/>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div className="h-eyebrow" style={{ marginBottom: 12 }}>Multi-quarter Gantt — workstreams</div>
        <div style={{ display:'grid', gridTemplateColumns: '220px repeat(4, 1fr)', gap: 4 }}>
          <div></div>
          {['Q3 2026','Q4 2026','Q1 2027','Q2 2027'].map(q => <div key={q} style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 8px' }}>{q}</div>)}
          {rows.map((r, i) => (
            <React.Fragment key={i}>
              <div style={{ fontSize: 12, padding: '8px 6px', color: 'var(--text)', borderTop: '1px solid var(--line-soft)' }}>{r.l}</div>
              {r.cells.map((c, j) => {
                const t = cellTone[c];
                return (
                  <div key={j} style={{
                    height: 30, margin: '4px 2px',
                    background: t.bg,
                    border: `1px solid ${t.bd}`,
                    borderRadius: 4,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize: 10.5, color: c==='—' ? 'var(--text-faint)' : 'var(--text-dim)',
                  }}>{t.l || ''}</div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Capability gap analysis</div>
          <CapabilityGapTable/>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Linked workspaces & projects</div>
          <div style={{ marginBottom: 12 }}>
            <div className="h-eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>Workspaces ({init.workspaceIds.length})</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
              {init.workspaceIds.map(wId => {
                const w = (FIXTURES.workspaces || []).find(x => x.id === wId);
                if (!w) return null;
                return (
                  <span key={wId} className="chip row-hover" onClick={() => navigate(`/workspace/${wId}`)} style={{ cursor:'pointer', fontSize: 11.5 }}>
                    <Icon name={w.icon} size={11} style={{ color: `hsl(${w.hue} 70% 65%)`, marginRight: 5 }}/>
                    {w.name}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="h-eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>Active projects ({init.projectIds.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              {init.projectIds.map(pId => {
                const p = (FIXTURES.projects || []).find(x => x.id === pId);
                if (!p) return null;
                return (
                  <div key={pId} className="row-hover" onClick={() => navigate(`/project/${pId}/dashboard`)}
                    style={{ padding:'8px 10px', display:'grid', gridTemplateColumns:'1fr 90px 100px', gap: 10, alignItems:'center', borderRadius: 5, cursor:'pointer', border:'1px solid var(--line-soft)' }}>
                    <div>
                      <div style={{ fontSize: 12.5 }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{p.phase}</div>
                    </div>
                    <Bar value={p.phasePct} max={100}/>
                    <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{(p.team || p.contributors || []).length || '—'} contributors</span>
                  </div>
                );
              })}
              {init.projectIds.length === 0 && <div style={{ fontSize: 11.5, color:'var(--text-mute)', fontStyle:'italic' }}>No active projects yet — kick one off from this initiative.</div>}
            </div>
          </div>

          <div>
            <div className="h-eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>Touched services</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 5 }}>
              {init.services.map(s => <span key={s} className="chip mono" style={{ fontSize: 11 }}>{s}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 12 }}>Stakeholder briefs — auto-generated by Tech-Writer</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 10 }}>
          {[
            { q:'Q3 2026', t:'Programme kickoff: scope & risks',   state:'published' },
            { q:'Q4 2026', t:'Mid-programme review',                state:'published' },
            { q:'Q1 2027', t:'Steering committee summary',          state:'draft' },
            { q:'Q2 2027', t:'Programme close-out',                 state:'pending' },
          ].map((b,i) => (
            <div key={i} style={{ padding: 12, border:'1px solid var(--line-soft)', borderRadius: 6, background:'var(--raised)' }}>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
                <Icon name="doc" size={12} style={{ color: 'var(--text-mute)' }}/>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--blue-bright)' }}>{b.q}</span>
              </div>
              <div style={{ fontSize: 12, marginBottom: 8, lineHeight:1.4 }}>{b.t}</div>
              <span style={{ fontSize: 10, fontWeight:600, padding:'2px 6px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.04em',
                background: b.state==='published'?'var(--green-bg)':b.state==='draft'?'var(--amber-bg)':'var(--raised)',
                color: b.state==='published'?'#A7F3D0':b.state==='draft'?'#FCD34D':'var(--text-mute)',
              }}>{b.state}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TxKPI = ({ label, v, sub, tone }) => (
  <div className="card" style={{ padding: 14 }}>
    <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: tone==='amber'?'var(--amber)':tone==='green'?'var(--green)':'var(--text)' }}>{v}</div>
    {sub && <div style={{ fontSize: 11, color:'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// NEW INITIATIVE FLOW — exported separately so it can be its own file later.
// ─────────────────────────────────────────────────────────────────────────
const NewInitiative = ({ navigate }) => {
  return window.NewInitiativeFlow
    ? <window.NewInitiativeFlow navigate={navigate}/>
    : <div style={{ padding: 40, color:'var(--text-mute)' }}>Loading new initiative flow…</div>;
};

window.TransformationsScreen = TransformationsScreen;

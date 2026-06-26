/* global React, Icon, Btn, Avatar, Bar, Pill, FIXTURES, fmt, PageHeader */
const { useState: uS_ops } = React;

// =============================================================================
// Ops
// - Top-level /ops  → cross-workspace dashboard (active issues + per-workspace strip)
// - Workspace level (rendered inside Workspace shell) → full operational view
//   (incidents · gates · SLOs · deploys) scoped to that workspace's services.
// =============================================================================

// --- Per-workspace ops fixtures keyed by workspace id ----
const OPS_BY_WORKSPACE = {
  'customer-portal': {
    services: ['portal-bff','identity-svc','session-svc','consent-svc','onboarding-svc','prefs-svc','notif-svc'],
    incidents: [
      { sev:'SEV-2', title:'portal-bff p95 latency spike', proj:'csp-v2', open:'14m', commander:{ name:'Sarah Chen', initials:'SC' }, svc:'portal-bff' },
    ],
    gates: [
      { id:'GATE-2026-205', proj:'csp-v2', gate:'Wave 1 → Wave 2 phase exit',  blockers:['1 Polaris unaddressed','2 specs in review'], wait:'42m' },
    ],
    slos: [
      { svc:'portal-bff',    metric:'p95 latency',     value:'412ms', target:'< 150ms', burn: 0.84, alert:true },
      { svc:'identity-svc',  metric:'auth success',    value:'99.94%', target:'≥ 99.9%', burn: 0.02 },
      { svc:'session-svc',   metric:'redis p99',       value:'18ms',   target:'< 50ms',  burn: 0.04 },
      { svc:'consent-svc',   metric:'GDPR purge SLA',  value:'24h',    target:'≤ 30d',   burn: 0.01 },
      { svc:'onboarding-svc',metric:'KYC pass rate',   value:'87%',    target:'≥ 85%',   burn: 0.10 },
    ],
    deploys: [
      { t:'04:18', svc:'portal-bff',   ver:'v3.18.2', who:'Engineer agent', state:'success' },
      { t:'03:47', svc:'consent-svc',  ver:'v1.9.4',  who:'Engineer agent', state:'success' },
      { t:'03:31', svc:'identity-svc', ver:'v4.11.1', who:'Engineer agent', state:'rolled-back' },
    ],
  },
  'data-and-ml': {
    services: ['fraud-scorer','feature-store','decision-engine','case-mgmt','model-registry'],
    incidents: [
      { sev:'SEV-3', title:'fraud-scorer feature drift > 0.08', proj:'fraud-uplift', open:'2h', commander:{ name:'Maya Patel', initials:'MP' }, svc:'fraud-scorer' },
    ],
    gates: [
      { id:'GATE-2026-204', proj:'fraud-uplift', gate:'Spec → Implementation', blockers:['Critic flagged 1 ambiguity'], wait:'1h 12m' },
    ],
    slos: [
      { svc:'fraud-scorer',    metric:'score drift',  value:'0.082', target:'< 0.05', burn: 0.71, alert:true },
      { svc:'feature-store',   metric:'freshness',    value:'42s',   target:'< 60s',  burn: 0.30 },
      { svc:'decision-engine', metric:'p95 latency',  value:'88ms',  target:'< 120ms',burn: 0.18 },
      { svc:'model-registry',  metric:'API success',  value:'99.99%',target:'≥ 99.9%',burn: 0.01 },
    ],
    deploys: [
      { t:'04:02', svc:'fraud-scorer', ver:'v3.2.0', who:'Engineer agent', state:'rolling' },
    ],
  },
  'lending-data': {
    services: ['snowflake-ingest','loan-ledger','warehouse-mart','reporting-warehouse'],
    incidents: [],
    gates: [
      { id:'GATE-2026-203', proj:'snowflake-ingest', gate:'Compliance → Production', blockers:['SOC2 evidence pending'], wait:'3h 04m' },
    ],
    slos: [
      { svc:'loan-ledger',    metric:'consistency lag', value:'2.1s',   target:'< 5s',   burn: 0.18 },
      { svc:'snowflake-ingest', metric:'pipeline lag',  value:'4m',     target:'< 15m',  burn: 0.10 },
      { svc:'warehouse-mart', metric:'query p95',       value:'1.8s',   target:'< 3s',   burn: 0.20 },
    ],
    deploys: [
      { t:'02:55', svc:'snowflake-ingest', ver:'v0.8.3', who:'Engineer agent', state:'success' },
    ],
  },
  'platform-foundations': {
    services: ['event-bus','auth-gateway','secret-store','feature-flags','telemetry'],
    incidents: [],
    gates: [],
    slos: [
      { svc:'event-bus',     metric:'delivery rate',   value:'99.99%', target:'≥ 99.95%', burn: 0.01 },
      { svc:'auth-gateway',  metric:'p99 latency',     value:'89ms',   target:'< 200ms', burn: 0.04 },
      { svc:'secret-store',  metric:'rotation backlog',value:'0',      target:'= 0',    burn: 0 },
      { svc:'feature-flags', metric:'eval p99',        value:'1.2ms',  target:'< 5ms',  burn: 0.02 },
    ],
    deploys: [
      { t:'03:12', svc:'profile-svc', ver:'v2.0.7', who:'Engineer agent', state:'success' },
    ],
  },
};

// =============================================================================
// TOP-LEVEL DASHBOARD

const OpsScreen = ({ navigate }) => {
  // build per-workspace summaries
  const wss = (FIXTURES.workspaces || []).map(w => {
    const o = OPS_BY_WORKSPACE[w.id] || { incidents:[], gates:[], slos:[], deploys:[], services:[] };
    return { w, ...o,
      sloAlerts: (o.slos || []).filter(s => s.alert).length,
      health: (o.incidents.length === 0 && (o.slos || []).every(s => !s.alert)) ? 'green'
            : (o.incidents.some(i => i.sev === 'SEV-1' || i.sev === 'SEV-2')) ? 'red'
            : 'amber',
    };
  });

  const totals = {
    incidents: wss.reduce((n,x) => n + x.incidents.length, 0),
    gates:     wss.reduce((n,x) => n + x.gates.length, 0),
    sloAlerts: wss.reduce((n,x) => n + x.sloAlerts, 0),
    deploys:   wss.reduce((n,x) => n + x.deploys.length, 0),
  };

  // flatten incidents and gates for "Active issues" list
  const issues = [];
  wss.forEach(({w, incidents, gates}) => {
    incidents.forEach(i => issues.push({ kind:'incident', w, ...i, sortKey: i.sev }));
    gates.forEach(g => issues.push({ kind:'gate', w, ...g, sortKey: 'GATE' }));
  });

  return (
    <div className="page-enter" style={{ padding:'20px 24px', maxWidth: 1480, margin:'0 auto' }}>
      <PageHeader
        eyebrow="Cross-workspace operational pulse"
        icon="pulse"
        title="Ops"
        subtitle="Active issues across every workspace. Drill into a workspace for the full operational view."
        role="The control tower. Each workspace runs its own services and owns its operational health — Ops here is the across-the-org view that surfaces the fires that need attention now."
        purpose="Triage live incidents, watch SLO burn, see which gates are stuck. Click a workspace to open its full ops console."
        contributes="Closes the loop on running systems. Polaris feeds new ideas in; workspace-level Ops watches them after they ship; FinOps tells you what they cost."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Severity</Btn>
          <Btn icon="bell">Subscribe</Btn>
        </>}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="Open incidents"  v={totals.incidents} sub={totals.incidents?'across the estate':'all clear'} tone={totals.incidents?'red':'mute'}/>
        <Kpi label="Stuck gates"     v={totals.gates}     sub="awaiting human" tone={totals.gates?'amber':'mute'}/>
        <Kpi label="SLO alerts"      v={totals.sloAlerts} sub="burn rate &gt; 70%" tone={totals.sloAlerts?'amber':'mute'}/>
        <Kpi label="Deploys today"   v={14}               sub="2 rolled back"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 14 }}>
        <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}><span style={{ color:'#FCA5A5' }}>● </span>Active issues</div>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{issues.length} need attention</span>
            </div>
            {issues.length === 0 && (
              <div style={{ padding: 24, textAlign:'center', color:'var(--green)', fontSize: 13 }}>All workspaces healthy.</div>
            )}
            {issues.map((x, i) => (
              <div key={i} className="row-hover"
                onClick={() => navigate(`/workspace/${x.w.id}/ops`)}
                style={{ padding:'12px 14px', borderTop: i?'1px solid var(--line-soft)':'none',
                  display:'grid', gridTemplateColumns:'72px 1fr 160px 90px 14px', gap: 12, alignItems:'center', cursor:'pointer' }}>
                {x.kind === 'incident'
                  ? <SevPill sev={x.sev}/>
                  : <span style={{ fontSize: 10, fontWeight: 600, color:'#FCD34D', background:'var(--amber-bg)', border:'1px solid rgba(245,158,11,0.4)', padding:'2px 6px', borderRadius: 3, justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>GATE</span>}
                <div>
                  <div style={{ fontSize: 13 }}>{x.kind === 'incident' ? x.title : x.gate}</div>
                  <div style={{ fontSize: 11, color:'var(--text-mute)' }}>
                    {x.kind === 'incident' ? `${x.proj} · ${x.svc}` : `${x.proj} · ${x.id}`}
                  </div>
                </div>
                <span className="chip blue">{x.w.name}</span>
                <span className="mono" style={{ fontSize: 11.5, color:'var(--amber)' }}>{x.kind==='incident'?`open ${x.open}`:`waiting ${x.wait}`}</span>
                <Icon name="chevron-right" size={12} style={{ color:'var(--text-mute)' }}/>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>SLO hot-spots — across all workspaces</div>
            </div>
            {wss.flatMap(x => x.slos.filter(s => s.alert).map(s => ({...s, w: x.w})))
                .map((s,i,arr) => <SLORow key={i} s={s} ws={s.w} first={i===0} navigate={navigate}/>)}
            {wss.every(x => x.slos.every(s => !s.alert)) && (
              <div style={{ padding: 18, textAlign:'center', color:'var(--green)', fontSize: 13 }}>All SLOs within budget.</div>
            )}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
          <div className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>By workspace</div>
            </div>
            {wss.map((x,i) => <WorkspaceOpsRow key={x.w.id} x={x} first={i===0} navigate={navigate}/>)}
          </div>

          <div className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Today, at a glance</div>
            </div>
            <div style={{ padding: 14, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
              <OpsBox label="Deploys" v="14" sub="2 rolled back" />
              <OpsBox label="Incidents opened" v="3" sub="2 still open" tone="amber"/>
              <OpsBox label="Gates passed" v="9" sub="3 still open" tone="green"/>
              <OpsBox label="Polaris dispatched" v="6" sub="of 12 pending"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ label, v, sub, tone }) => {
  const tones = { red:'#FCA5A5', amber:'var(--amber)', mute:'var(--text)' };
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tones[tone] || 'var(--text)' }}>{v}</div>
      <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }} dangerouslySetInnerHTML={{__html: sub}}/>
    </div>
  );
};

const HEALTH_DOT = { green:'var(--green)', amber:'var(--amber)', red:'#EF4444' };

const WorkspaceOpsRow = ({ x, first, navigate }) => (
  <div className="row-hover"
    onClick={() => navigate(`/workspace/${x.w.id}/ops`)}
    style={{ padding:'12px 14px', borderTop: first?'none':'1px solid var(--line-soft)', display:'grid', gridTemplateColumns:'14px 1fr auto 14px', gap: 10, alignItems:'center', cursor:'pointer' }}>
    <span style={{ width: 9, height: 9, borderRadius: 5, background: HEALTH_DOT[x.health], boxShadow: x.health==='red'?'0 0 0 3px rgba(239,68,68,0.18)':x.health==='amber'?'0 0 0 3px rgba(245,158,11,0.15)':'none' }}/>
    <div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{x.w.name}</div>
      <div style={{ fontSize: 11, color:'var(--text-mute)' }}>
        {x.services.length} services · {x.incidents.length} incidents · {x.gates.length} gates · {x.sloAlerts} SLO alerts
      </div>
    </div>
    <div style={{ display:'flex', gap: 4 }}>
      {x.incidents.length > 0 && <Pip n={x.incidents.length} tone="red" label="inc"/>}
      {x.gates.length > 0     && <Pip n={x.gates.length}     tone="amber" label="gate"/>}
      {x.sloAlerts > 0        && <Pip n={x.sloAlerts}        tone="amber" label="slo"/>}
      {x.health === 'green'   && <span style={{ fontSize: 11, color:'var(--green)' }}>healthy</span>}
    </div>
    <Icon name="chevron-right" size={12} style={{ color:'var(--text-mute)' }}/>
  </div>
);

const Pip = ({ n, tone, label }) => {
  const t = tone === 'red'
    ? { bg:'var(--red-bg)', c:'#FCA5A5', border:'rgba(239,68,68,0.4)' }
    : { bg:'var(--amber-bg)', c:'#FCD34D', border:'rgba(245,158,11,0.4)' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 3, fontSize: 10.5, fontWeight: 600,
      padding:'2px 6px', borderRadius: 3, background: t.bg, color: t.c, border:`1px solid ${t.border}` }}>
      <span className="mono">{n}</span><span style={{ textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</span>
    </span>
  );
};

const SevPill = ({ sev }) => (
  <span style={{ fontSize: 10.5, fontWeight: 600, color:'#FCA5A5', background:'var(--red-bg)', border:'1px solid rgba(239,68,68,0.4)', padding:'2px 6px', borderRadius: 3, justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>{sev}</span>
);

const OpsBox = ({ label, v, sub, tone }) => (
  <div style={{ background:'var(--raised)', border:'1px solid var(--line-soft)', borderRadius: 6, padding:'10px 12px' }}>
    <div className="h-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 600, color: tone==='green'?'var(--green)':tone==='amber'?'var(--amber)':'var(--text)' }}>{v}</div>
    <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{sub}</div>
  </div>
);

// =============================================================================
// WORKSPACE-LEVEL FULL OPS VIEW (rendered inside Workspace shell as the Ops tab)

const WorkspaceOpsScreen = ({ w, navigate }) => {
  const [tab, setTab] = uS_ops('pulse');
  const ops = OPS_BY_WORKSPACE[w.id] || { incidents:[], gates:[], slos:[], deploys:[], services:[] };
  const tabs = [
    { id:'pulse',     label:'Live pulse'},
    { id:'incidents', label:'Incidents',   count: ops.incidents.length },
    { id:'gates',     label:'Open gates',  count: ops.gates.length },
    { id:'slos',      label:'SLOs',        count: (ops.slos||[]).filter(s=>s.alert).length || null },
    { id:'deploys',   label:'Deploys',     count: ops.deploys.length },
  ];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 14 }}>
        <div>
          <div className="h-eyebrow">Workspace operations</div>
          <h2 style={{ margin:'2px 0 4px', fontSize: 18, fontWeight: 600 }}>Ops · {w.name}</h2>
          <div style={{ fontSize: 12, color:'var(--text-mute)' }}>{ops.services.length} services · live incidents, gates, SLOs and deploys for this workspace.</div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn icon="bell" size="sm">Subscribe</Btn>
          <Btn icon="rocket" size="sm" onClick={() => navigate('/releases')}>Releases</Btn>
        </div>
      </div>

      <div style={{ display:'flex', gap: 4, borderBottom:'1px solid var(--line)', marginBottom: 18 }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}
            style={{ borderBottom: tab===t.id?'2px solid var(--blue-bright)':'2px solid transparent' }}>
            {t.label}
            {t.count != null && t.count > 0 && <span style={{ fontSize: 10, marginLeft: 6, padding:'1px 5px', borderRadius: 8, background:'var(--red-bg)', color:'#FCA5A5' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'pulse'     && <Pulse ops={ops} navigate={navigate}/>}
      {tab === 'incidents' && <IncidentList incidents={ops.incidents}/>}
      {tab === 'gates'     && <GateList gates={ops.gates} navigate={navigate}/>}
      {tab === 'slos'      && <SLOList slos={ops.slos}/>}
      {tab === 'deploys'   && <DeployList deploys={ops.deploys}/>}
    </div>
  );
};

const Pulse = ({ ops, navigate }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 14 }}>
    <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}><span style={{ color: ops.incidents.length?'#FCA5A5':'var(--green)' }}>● </span>Open incidents</div>
          <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{ops.incidents.length} active</span>
        </div>
        {ops.incidents.length === 0
          ? <div style={{ padding: 18, textAlign:'center', color:'var(--text-mute)', fontSize: 12 }}>None open.</div>
          : ops.incidents.map((x,i) => (
            <div key={i} style={{ padding:'12px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'72px 1fr 130px 80px', gap: 12, alignItems:'center' }}>
              <SevPill sev={x.sev}/>
              <div>
                <div style={{ fontSize: 13 }}>{x.title}</div>
                <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{x.proj} · {x.svc}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <Avatar name={x.commander.name} initials={x.commander.initials} size={20}/>
                <span style={{ fontSize: 11.5 }}>{x.commander.name}</span>
              </div>
              <span className="mono" style={{ fontSize: 11.5, color:'var(--amber)' }}>open {x.open}</span>
            </div>
          ))}
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>SLO hot-spots</div>
        </div>
        {(ops.slos || []).filter(s => s.alert).map((s,i) => <SLORow key={s.svc} s={s} first={i===0}/>)}
        {(ops.slos || []).every(s => !s.alert) && (
          <div style={{ padding: 18, textAlign:'center', color:'var(--green)', fontSize: 13 }}>All SLOs within budget.</div>
        )}
      </div>
    </div>

    <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Today, at a glance</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10 }}>
          <OpsBox label="Deploys"          v={ops.deploys.length} sub={ops.deploys.filter(d=>d.state==='rolled-back').length+' rolled back'}/>
          <OpsBox label="Incidents"        v={ops.incidents.length} sub="open right now" tone={ops.incidents.length?'amber':'green'}/>
          <OpsBox label="Gates open"       v={ops.gates.length}    sub="awaiting" tone={ops.gates.length?'amber':'green'}/>
          <OpsBox label="SLO alerts"       v={(ops.slos||[]).filter(s=>s.alert).length} sub={`of ${(ops.slos||[]).length}`} tone="amber"/>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>Recent deploys</div>
        </div>
        {ops.deploys.length === 0 && <div style={{ padding: 18, textAlign:'center', color:'var(--text-mute)', fontSize: 12 }}>None today.</div>}
        {ops.deploys.slice(0, 5).map((d,i) => (
          <div key={i} style={{ padding:'9px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'45px 1fr auto', gap: 10, alignItems:'center', fontSize: 12 }}>
            <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{d.t}</span>
            <div>
              <span className="mono" style={{ fontSize: 11.5 }}>{d.svc}</span>
              <span style={{ fontSize: 11, color:'var(--text-mute)', marginLeft: 6 }}>{d.ver}</span>
            </div>
            <DeployBadge state={d.state}/>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const SLORow = ({ s, ws, first, navigate }) => (
  <div className="row-hover"
    onClick={ws ? () => navigate(`/workspace/${ws.id}/ops`) : undefined}
    style={{ padding:'10px 14px', borderTop: first?'none':'1px solid var(--line-soft)', display:'grid', gridTemplateColumns: ws ? '120px 130px 1fr 90px 100px 80px' : '140px 1fr 110px 110px 80px', gap: 10, alignItems:'center', fontSize: 12, cursor: ws?'pointer':'default' }}>
    {ws && <span className="chip blue" style={{ fontSize: 10 }}>{ws.name}</span>}
    <span className="mono" style={{ fontSize: 11.5, color:'var(--blue-bright)' }}>{s.svc}</span>
    <span style={{ color:'var(--text-dim)' }}>{s.metric}</span>
    <span className="mono" style={{ fontSize: 11.5, color: s.alert?'var(--amber)':'var(--text)' }}>{s.value}</span>
    <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.target}</span>
    <BurnBar burn={s.burn}/>
  </div>
);

const BurnBar = ({ burn }) => {
  const tone = burn > 0.7 ? '#EF4444' : burn > 0.3 ? '#F59E0B' : '#10B981';
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 5 }}>
      <div style={{ width: 50, height: 5, background:'var(--raised)', borderRadius: 3 }}>
        <div style={{ width:`${burn*100}%`, height:'100%', background: tone, borderRadius: 3 }}/>
      </div>
      <span className="mono" style={{ fontSize: 10.5, color: tone }}>{(burn*100).toFixed(0)}%</span>
    </div>
  );
};

const DeployBadge = ({ state }) => {
  const map = {
    success:    { c:'#A7F3D0', bg:'var(--green-bg)', l:'success' },
    rolling:    { c:'#BFDBFE', bg:'var(--blue-bg)',  l:'rolling' },
    'rolled-back': { c:'#FCA5A5', bg:'var(--red-bg)', l:'rolled back' },
  };
  const t = map[state];
  return <span style={{ fontSize: 10, fontWeight: 600, padding:'2px 6px', borderRadius: 3, background: t.bg, color: t.c, textTransform:'uppercase', letterSpacing:'0.04em' }}>{t.l}</span>;
};

const IncidentList = ({ incidents }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'80px 1fr 130px 130px 110px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
      <span>Sev</span><span>Title</span><span>Project</span><span>Commander</span><span>Open for</span>
    </div>
    {incidents.length === 0 && <div style={{ padding: 26, textAlign:'center', color:'var(--green)', fontSize: 13 }}>No open incidents.</div>}
    {incidents.map((x,i) => (
      <div key={i} style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'80px 1fr 130px 130px 110px', gap: 12, alignItems:'center' }}>
        <SevPill sev={x.sev}/>
        <div>
          <div style={{ fontSize: 13 }}>{x.title}</div>
          <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{x.svc}</div>
        </div>
        <span className="chip">{x.proj}</span>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <Avatar name={x.commander.name} initials={x.commander.initials} size={20}/><span style={{ fontSize: 11.5 }}>{x.commander.name}</span>
        </div>
        <span className="mono" style={{ fontSize: 11.5, color:'var(--amber)' }}>{x.open}</span>
      </div>
    ))}
  </div>
);

const GateList = ({ gates, navigate }) => (
  <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
    {gates.length === 0 && <div className="card" style={{ padding: 26, textAlign:'center', color:'var(--green)', fontSize: 13 }}>No gates blocked.</div>}
    {gates.map(g => (
      <div key={g.id} className="card" style={{ padding: 16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 14 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', gap: 8, marginBottom: 6, alignItems:'center' }}>
              <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{g.id}</span>
              <span className="chip blue">{g.proj}</span>
              <span className="mono" style={{ fontSize: 11, color:'var(--amber)' }}>waiting {g.wait}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>{g.gate}</div>
            <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
              {g.blockers.map((b, i) => (
                <div key={i} style={{ fontSize: 12, color:'var(--text-dim)', paddingLeft: 14, position:'relative' }}>
                  <span style={{ position:'absolute', left: 0, color:'var(--amber)' }}>⚠</span>{b}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
            <Btn variant="primary" icon="check">Pass gate</Btn>
            <Btn icon="alert" onClick={() => navigate('/help-me')}>Re-plan</Btn>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SLOList = ({ slos }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'140px 1fr 110px 110px 80px', gap: 10, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
      <span>Service</span><span>Metric</span><span>Value</span><span>Target</span><span>Burn</span>
    </div>
    {(slos||[]).map((s,i) => <SLORow key={s.svc} s={s} first={i===0}/>)}
  </div>
);

const DeployList = ({ deploys }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'80px 200px 100px 1fr 100px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
      <span>Time</span><span>Service</span><span>Version</span><span>By</span><span>State</span>
    </div>
    {deploys.length === 0 && <div style={{ padding: 26, textAlign:'center', color:'var(--text-mute)', fontSize: 13 }}>No deploys today.</div>}
    {deploys.map((d, i) => (
      <div key={i} style={{ padding:'10px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'80px 200px 100px 1fr 100px', gap: 12, alignItems:'center', fontSize: 12 }}>
        <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{d.t}</span>
        <span className="mono" style={{ fontSize: 11.5 }}>{d.svc}</span>
        <span className="mono" style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{d.ver}</span>
        <span style={{ color:'var(--text-dim)' }}>{d.who}</span>
        <DeployBadge state={d.state}/>
      </div>
    ))}
  </div>
);

window.OpsScreen = OpsScreen;
window.WorkspaceOpsScreen = WorkspaceOpsScreen;

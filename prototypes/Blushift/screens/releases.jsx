/* global React, Icon, Btn, Avatar, Pill, FIXTURES, fmt, PageHeader */
const { useState: uS_rel, useMemo: uM_rel, useEffect: uE_rel } = React;

// =============================================================================
// Releases — top-level release management.
// Plan, schedule, notify and track releases across workspaces. Surfaces
// upstream/downstream impact, planned outages, freeze windows, change-board
// status, and stakeholder comms.
// =============================================================================

const RELEASES = [
  {
    id: 'REL-2026-W19-018',
    title: 'CSP v2 — Wave 1 cutover',
    project: 'csp-v2',
    workspace: 'Customer Banking',
    type: 'major',
    risk: 'high',
    state: 'scheduled',
    window: { start: 'Wed 13 May · 22:00 UTC', end: 'Wed 13 May · 23:30 UTC', tz: 'Europe/London' },
    duration: '90m',
    outage: { kind: 'partial', services: ['portal-bff','session-svc'], note: 'Read-only banner on portal for ~6m during cutover' },
    services: ['portal-bff','session-svc','identity-svc','consent-svc'],
    upstream: ['identity-svc','feature-flags','event-bus'],
    downstream: ['mobile-app','partner-api','analytics-pipeline'],
    artifacts: [
      { repo:'csp-portal', sha:'a1b2c3d', tag:'v3.18.0' },
      { repo:'portal-bff', sha:'e4f5g6h', tag:'v3.18.2' },
      { repo:'session-svc', sha:'i7j8k9l', tag:'v2.4.0' },
    ],
    owner: { name:'Sarah Chen', initials:'SC' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [
      { name:'Priya Shah',  initials:'PS', role:'Eng director', state:'approved' },
      { name:'Marcus Webb', initials:'MW', role:'CISO',         state:'approved' },
      { name:'Lila Nakamura', initials:'LN', role:'CAB',        state:'pending'  },
    ],
    runbook: 'wiki/runbooks/csp-v2-cutover.md',
    rollback: 'Switch ALB target group back to v3.17 — RTO < 4m',
    notifications: { sent: 142, channels:['#csp-v2','#release-board','status-page','partner-comms'], next:'T-24h reminder Tue 22:00 UTC' },
    polaris: 2,
    incidents: 0,
    progress: 70,
    checks: [
      { l:'Spec sign-off',           ok:true  },
      { l:'Visual regression baseline', ok:true  },
      { l:'Load test (1.5x peak)',  ok:true  },
      { l:'Compliance evidence',    ok:true  },
      { l:'CAB approval',           ok:false },
      { l:'Stakeholder comms T-24h',ok:false },
    ],
  },
  {
    id: 'REL-2026-W19-017',
    title: 'fraud-scorer v3.2 model uplift',
    project: 'fraud-uplift',
    workspace: 'Risk & Compliance',
    type: 'standard',
    risk: 'medium',
    state: 'in-flight',
    window: { start: 'Today · 04:02 UTC', end: 'Today · 06:00 UTC', tz: 'Europe/London' },
    duration: '~120m (canary)',
    outage: { kind:'none', note:'Shadow then 5%/25%/50%/100% canary' },
    services: ['fraud-scorer'],
    upstream: ['feature-store','event-bus'],
    downstream: ['decision-engine','case-mgmt','reporting-warehouse'],
    artifacts: [{ repo:'fraud-scorer', sha:'b3d4e5f', tag:'v3.2.0' }],
    owner: { name:'Maya Patel', initials:'MP' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [
      { name:'Priya Shah',  initials:'PS', role:'Eng director', state:'approved' },
      { name:'Hugo Bennett', initials:'HB', role:'Risk',        state:'approved' },
    ],
    runbook: 'wiki/runbooks/model-canary.md',
    rollback: 'Flip flag fraud.scorer.version → v3.1 — RTO < 30s',
    notifications: { sent: 38, channels:['#fraud-uplift','#risk-board'], next:'on canary stage change' },
    polaris: 1,
    incidents: 0,
    progress: 45,
    canary: { stage: '25%', drift: '0.082', alarmed: true },
    checks: [
      { l:'Shadow run 24h ≥ baseline', ok:true  },
      { l:'5% canary',                 ok:true  },
      { l:'25% canary',                ok:true  },
      { l:'Drift < 0.05',              ok:false },
      { l:'50% canary',                ok:false },
      { l:'100%',                      ok:false },
    ],
  },
  {
    id: 'REL-2026-W19-016',
    title: 'Lending Snowflake ingestion v0.8.3',
    project: 'snowflake-ingest',
    workspace: 'Data Platform',
    type: 'standard',
    risk: 'low',
    state: 'completed',
    window: { start: 'Today · 02:55 UTC', end: 'Today · 03:18 UTC', tz: 'Europe/London' },
    duration: '23m',
    outage: { kind:'none' },
    services: ['snowflake-ingest'],
    upstream: ['loan-ledger','event-bus'],
    downstream: ['warehouse-mart','reporting-warehouse'],
    artifacts: [{ repo:'snowflake-ingest', sha:'9f3a2b1', tag:'v0.8.3' }],
    owner: { name:'Alex Hart', initials:'AH' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [{ name:'Priya Shah', initials:'PS', role:'Eng director', state:'approved' }],
    notifications: { sent: 12, channels:['#data-platform'] },
    polaris: 0,
    incidents: 0,
    progress: 100,
    checks: [
      { l:'Schema migration', ok:true },
      { l:'Backfill verified', ok:true },
      { l:'Downstream marts validated', ok:true },
    ],
    completedAt: '03:18 UTC · 0 incidents',
  },
  {
    id: 'REL-2026-W20-019',
    title: 'identity-svc v4.12 — JWKS rotation',
    project: 'identity',
    workspace: 'Platform',
    type: 'standard',
    risk: 'medium',
    state: 'planning',
    window: { start: 'Tue 19 May · 03:00 UTC', end: 'Tue 19 May · 04:00 UTC', tz: 'Europe/London' },
    duration: '60m',
    outage: { kind:'none', note:'Dual-publish keys for 14 days; clients auto-rotate' },
    services: ['identity-svc','auth-gateway'],
    upstream: ['secret-store'],
    downstream: ['portal-bff','session-svc','partner-api','mobile-app','admin-console'],
    artifacts: [{ repo:'identity-svc', sha:'pending', tag:'v4.12.0' }],
    owner: { name:'Yusuf Khalid', initials:'YK' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [
      { name:'Marcus Webb', initials:'MW', role:'CISO', state:'pending' },
      { name:'Priya Shah',  initials:'PS', role:'Eng director', state:'pending' },
    ],
    notifications: { sent: 0, channels:[], next:'After CAB approval' },
    polaris: 0,
    incidents: 0,
    progress: 20,
    checks: [
      { l:'Spec',            ok:true  },
      { l:'Dual-publish PR', ok:false },
      { l:'CISO approval',   ok:false },
      { l:'CAB approval',    ok:false },
      { l:'Comms drafted',   ok:false },
    ],
  },
  {
    id: 'REL-2026-W18-014',
    title: 'profile-svc v2.0.7 — schema migration',
    project: 'identity',
    workspace: 'Platform',
    type: 'standard',
    risk: 'low',
    state: 'completed',
    window: { start: 'Mon 4 May · 03:12 UTC', end: 'Mon 4 May · 03:46 UTC', tz: 'Europe/London' },
    duration: '34m',
    outage: { kind:'none' },
    services: ['profile-svc'],
    upstream: ['user-db'],
    downstream: ['portal-bff','partner-api','mobile-app'],
    owner: { name:'Yusuf Khalid', initials:'YK' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [{ name:'Priya Shah', initials:'PS', role:'Eng director', state:'approved' }],
    progress: 100,
    notifications: { sent: 24, channels:['#platform'] },
    polaris: 0, incidents: 0,
    checks: [],
    completedAt: 'Mon 4 May · 03:46 UTC · 0 incidents',
  },
  {
    id: 'REL-2026-W17-011',
    title: 'consent-svc v1.9.4 — GDPR purge job',
    project: 'consent',
    workspace: 'Risk & Compliance',
    type: 'standard',
    risk: 'medium',
    state: 'completed',
    window: { start: 'Wed 22 Apr · 22:00 UTC', end: 'Wed 22 Apr · 22:48 UTC', tz: 'Europe/London' },
    duration: '48m',
    outage: { kind:'partial', services:['consent-svc'], note:'API returned 503 for ~90s during cutover' },
    services: ['consent-svc'],
    upstream: ['user-db'],
    downstream: ['portal-bff','marketing-svc','reporting-warehouse'],
    owner: { name:'Hugo Bennett', initials:'HB' },
    rm: { name:'Devon Ortiz', initials:'DO' },
    approvers: [{ name:'Marcus Webb', initials:'MW', role:'CISO', state:'approved' }],
    progress: 100,
    notifications: { sent: 56, channels:['#consent','#risk-board','status-page'] },
    polaris: 0, incidents: 1,
    checks: [],
    completedAt: 'Wed 22 Apr · 22:48 UTC · 1 incident (resolved)',
    incidentNote: 'SEV-3 — partner-api retries spiked during 90s blip; auto-resolved.',
  },
];

const FREEZES = [
  { name:'Quarter-end close',  start:'Thu 28 May 18:00', end:'Mon 1 Jun 06:00', scope:'All Risk & Compliance', kind:'business' },
  { name:'Black Friday peak',  start:'Thu 26 Nov 00:00', end:'Tue 1 Dec 06:00', scope:'Customer Banking + Mobile', kind:'business' },
];

const REL_RISK_TONE = {
  low:    { c:'#86EFAC', bg:'var(--green-bg)', border:'rgba(16,185,129,0.4)' },
  medium: { c:'#FCD34D', bg:'var(--amber-bg)', border:'rgba(245,158,11,0.4)' },
  high:   { c:'#FCA5A5', bg:'var(--red-bg)',   border:'rgba(239,68,68,0.4)' },
};
const REL_STATE_TONE = {
  planning:   { c:'#94A3B8', bg:'rgba(148,163,184,0.12)', l:'Planning' },
  scheduled:  { c:'#BFDBFE', bg:'var(--blue-bg)',         l:'Scheduled' },
  'in-flight':{ c:'#A78BFA', bg:'var(--purple-bg)',       l:'In flight' },
  completed:  { c:'#86EFAC', bg:'var(--green-bg)',        l:'Completed' },
  rolled_back:{ c:'#FCA5A5', bg:'var(--red-bg)',          l:'Rolled back' },
};

// =============================================================================

const ReleasesScreen = ({ navigate }) => {
  const [tab, setTab] = uS_rel('upcoming');
  const [picked, setPicked] = uS_rel(null);
  const [planOpen, setPlanOpen] = uS_rel(false);

  const tabs = [
    { id:'upcoming', label:'Upcoming',  count: RELEASES.filter(r=>r.state==='scheduled'||r.state==='planning').length },
    { id:'inflight', label:'In flight', count: RELEASES.filter(r=>r.state==='in-flight').length },
    { id:'calendar', label:'Calendar' },
    { id:'history',  label:'History',   count: RELEASES.filter(r=>r.state==='completed'||r.state==='rolled_back').length },
    { id:'freezes',  label:'Freezes & windows', count: FREEZES.length },
  ];

  const upcoming = RELEASES.filter(r=>r.state==='scheduled'||r.state==='planning');
  const inflight = RELEASES.filter(r=>r.state==='in-flight');
  const history  = RELEASES.filter(r=>r.state==='completed'||r.state==='rolled_back');

  return (
    <div className="page-enter" style={{ padding:'20px 24px', maxWidth: 1480, margin:'0 auto' }}>
      <PageHeader
        eyebrow="Release management"
        icon="rocket"
        title="Releases"
        subtitle="Plan, notify and track every release. See impact upstream and downstream before you ship."
        role="The release control tower. Where Ops shows you what's running right now, Releases shows you what's about to change — and who needs to know."
        purpose="Schedule cutovers, declare outage windows, capture upstream/downstream impact, route approvals, and keep stakeholders informed."
        contributes="Closes the loop between change and operations. Every release links to its source project, its risk band, its CAB approvals, and the comms it triggered."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Workspace</Btn>
          <Btn icon="bell" size="sm">Subscribe</Btn>
          <Btn icon="plus" variant="primary" onClick={() => setPlanOpen(true)}>Plan release</Btn>
        </>}
      />

      <KpiStrip releases={RELEASES}/>

      <div style={{ display:'flex', gap: 4, borderBottom:'1px solid var(--line)', marginBottom: 18, marginTop: 18 }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}
            style={{ borderBottom: tab===t.id?'2px solid var(--blue-bright)':'2px solid transparent' }}>
            {t.label}
            {t.count != null && <span style={{ fontSize: 10, marginLeft: 6, padding:'1px 5px', borderRadius: 8, background:'var(--raised)', color:'var(--text-mute)' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && <ReleaseList releases={upcoming} onPick={setPicked}/>}
      {tab === 'inflight' && <InFlightView  releases={inflight} onPick={setPicked}/>}
      {tab === 'calendar' && <CalendarView  releases={RELEASES} onPick={setPicked}/>}
      {tab === 'history'  && <ReleaseList releases={history}  onPick={setPicked} muted/>}
      {tab === 'freezes'  && <FreezesView/>}

      {picked && <ReleaseDrawer release={picked} onClose={() => setPicked(null)} navigate={navigate}/>}
      {planOpen && <PlanReleaseModal onClose={() => setPlanOpen(false)} navigate={navigate}/>}
    </div>
  );
};

// =============================================================================

const KpiStrip = ({ releases }) => {
  const upcoming7 = releases.filter(r => r.state==='scheduled' || r.state==='planning').length;
  const inflight  = releases.filter(r => r.state==='in-flight').length;
  const high      = releases.filter(r => r.risk==='high' && (r.state==='scheduled'||r.state==='in-flight')).length;
  const last30 = releases.filter(r => r.state==='completed').length;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 10 }}>
      <Kpi label="Upcoming · 14d"    v={upcoming7} sub="across all workspaces"/>
      <Kpi label="In flight"          v={inflight}  sub="canary in progress" tone="purple"/>
      <Kpi label="High-risk pending"  v={high}      sub="needs CAB sign-off" tone={high?'amber':'mute'}/>
      <Kpi label="Last 30d"           v={last30 + 8} sub="98.4% success rate"/>
      <Kpi label="Active freezes"     v={FREEZES.length} sub="next: " subBold="quarter-end" tone="amber"/>
    </div>
  );
};

const Kpi = ({ label, v, sub, subBold, tone }) => {
  const tones = {
    purple:'#C4B5FD', amber:'var(--amber)', mute:'var(--text)',
  };
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tones[tone] || 'var(--text)' }}>{v}</div>
      <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>{sub}{subBold && <span style={{ color:'var(--text-dim)' }}>{subBold}</span>}</div>
    </div>
  );
};

// =============================================================================
// LIST VIEW

const ReleaseList = ({ releases, onPick, muted }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)',
      display:'grid', gridTemplateColumns:'130px 1fr 130px 90px 100px 130px 90px 90px',
      gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
      <span>ID</span><span>Title</span><span>Project</span><span>Risk</span><span>State</span><span>Window</span><span>Outage</span><span>Approvals</span>
    </div>
    {releases.map((r, i) => (
      <div key={r.id} className="row-hover" onClick={() => onPick(r)}
        style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none',
          display:'grid', gridTemplateColumns:'130px 1fr 130px 90px 100px 130px 90px 90px',
          gap: 12, alignItems:'center', cursor:'pointer',
          opacity: muted ? 0.85 : 1 }}>
        <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.id}</span>
        <div>
          <div style={{ fontSize: 13, color: muted?'var(--text-dim)':'var(--text)' }}>{r.title}</div>
          <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.workspace} · {r.services.length} svc · ↑{r.upstream.length}/↓{r.downstream.length}</div>
        </div>
        <span className="chip blue">{r.project}</span>
        <RiskPill risk={r.risk}/>
        <StatePill state={r.state}/>
        <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>
          <div className="mono" style={{ fontSize: 11 }}>{r.window.start.split(' · ')[0]}</div>
          <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{r.window.start.split(' · ')[1]} · {r.duration}</div>
        </div>
        <OutagePill outage={r.outage}/>
        <ApprovalGlyphs approvers={r.approvers}/>
      </div>
    ))}
  </div>
);

const RiskPill = ({ risk }) => {
  const t = REL_RISK_TONE[risk];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: t.bg, color: t.c, textTransform:'uppercase', letterSpacing:'0.05em', border:`1px solid ${t.border}`, justifySelf:'start' }}>
      {risk}
    </span>
  );
};
const StatePill = ({ state }) => {
  const t = REL_STATE_TONE[state];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: t.bg, color: t.c, justifySelf:'start' }}>
      {t.l}
    </span>
  );
};
const OutagePill = ({ outage }) => {
  if (!outage || outage.kind === 'none') {
    return <span style={{ fontSize: 11, color:'var(--text-mute)' }}>none</span>;
  }
  const t = outage.kind === 'partial'
    ? { c:'#FCD34D', bg:'var(--amber-bg)' }
    : { c:'#FCA5A5', bg:'var(--red-bg)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding:'2px 6px', borderRadius: 3, background: t.bg, color: t.c, textTransform:'uppercase', justifySelf:'start' }}>
      {outage.kind}
    </span>
  );
};
const ApprovalGlyphs = ({ approvers }) => {
  if (!approvers || !approvers.length) return <span style={{ fontSize: 11, color:'var(--text-mute)' }}>—</span>;
  const ok = approvers.filter(a => a.state==='approved').length;
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 4 }}>
      <div style={{ display:'flex' }}>
        {approvers.slice(0,3).map((a,i) => (
          <div key={i} style={{ marginLeft: i?-6:0, position:'relative' }}>
            <Avatar name={a.name} initials={a.initials} size={20}/>
            {a.state === 'approved' && (
              <span style={{ position:'absolute', bottom:-2, right:-2, width:9, height:9, borderRadius:5, background:'var(--green)', border:'1.5px solid var(--bg)' }}/>
            )}
            {a.state === 'pending' && (
              <span style={{ position:'absolute', bottom:-2, right:-2, width:9, height:9, borderRadius:5, background:'var(--amber)', border:'1.5px solid var(--bg)' }}/>
            )}
          </div>
        ))}
      </div>
      <span className="mono" style={{ fontSize: 10.5, color: ok===approvers.length?'var(--green)':'var(--amber)' }}>{ok}/{approvers.length}</span>
    </div>
  );
};

// =============================================================================
// IN-FLIGHT VIEW

const InFlightView = ({ releases, onPick }) => {
  if (!releases.length) {
    return (
      <div className="card" style={{ padding: 40, textAlign:'center', color:'var(--text-mute)', fontSize: 13 }}>
        Nothing rolling out right now.
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      {releases.map(r => <InFlightCard key={r.id} r={r} onPick={onPick}/>)}
    </div>
  );
};

const InFlightCard = ({ r, onPick }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden', borderColor: 'rgba(139,92,246,0.3)' }}>
    <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap: 12 }}>
      <div>
        <div style={{ display:'flex', gap: 8, alignItems:'center', marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.id}</span>
          <StatePill state={r.state}/>
          <RiskPill risk={r.risk}/>
          {r.canary?.alarmed && <span style={{ fontSize: 10.5, color:'#FCA5A5', background:'var(--red-bg)', padding:'1px 6px', borderRadius: 3, border:'1px solid rgba(239,68,68,0.4)', fontWeight:600 }}>DRIFT ALARM</span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
        <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>{r.workspace} · {r.project} · started {r.window.start}</div>
      </div>
      <div style={{ display:'flex', gap: 8 }}>
        <Btn icon="pause">Hold</Btn>
        <Btn icon="branch">Rollback</Btn>
        <Btn variant="primary" icon="arrow-right" onClick={() => onPick(r)}>Open</Btn>
      </div>
    </div>
    <div style={{ padding:'14px 18px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>Canary progress</div>
          <CanaryStrip stage={r.canary?.stage}/>
          {r.canary?.drift && (
            <div style={{ marginTop: 10, fontSize: 11.5, color:'var(--text-dim)' }}>
              Drift: <span className="mono" style={{ color:'var(--amber)' }}>{r.canary.drift}</span> <span style={{ color:'var(--text-mute)' }}>(target &lt; 0.05)</span>
            </div>
          )}
        </div>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>Downstream impact</div>
          <ImpactRibbon r={r}/>
        </div>
      </div>
    </div>
  </div>
);

const CanaryStrip = ({ stage }) => {
  const stages = ['shadow','5%','25%','50%','100%'];
  const idx = stages.indexOf(stage) + 1;
  return (
    <div style={{ display:'flex', gap: 4 }}>
      {stages.map((s, i) => (
        <div key={s} style={{ flex: 1, display:'flex', flexDirection:'column', alignItems:'center', gap: 4 }}>
          <div style={{
            width:'100%', height: 6, borderRadius: 3,
            background: i < idx ? '#A78BFA' : i === idx ? 'rgba(167,139,250,0.4)' : 'var(--raised)',
          }}/>
          <span className="mono" style={{ fontSize: 10, color: i < idx ? '#C4B5FD' : 'var(--text-mute)' }}>{s}</span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// CALENDAR VIEW (week strip)

const CalendarView = ({ releases, onPick }) => {
  // 14-day strip starting Monday this week
  const days = uM_rel(() => {
    const start = new Date('2026-05-04'); // Monday W19
    return Array.from({length: 14}, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate()+i);
      return d;
    });
  }, []);
  const dayMap = (d) => {
    const key = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric' });
    return key;
  };

  // bucket releases by day-of-week heuristically using window.start "Wed 13 May"
  const inDay = (rel, date) => {
    const dow = date.toLocaleDateString('en-GB', { weekday:'short' });
    const dom = date.getDate();
    const m = rel.window.start.match(/(\w+)\s+(\d+)/);
    if (!m) return false;
    return m[1] === dow && parseInt(m[2],10) === dom;
  };

  return (
    <div>
      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(14, 1fr)', borderBottom:'1px solid var(--line)' }}>
          {days.map((d,i) => {
            const isWeekend = d.getDay()===0 || d.getDay()===6;
            const isToday = d.getDate() === 5 && d.getMonth() === 4;
            return (
              <div key={i} style={{
                padding: '10px 8px', borderRight: i<13?'1px solid var(--line-soft)':'none',
                background: isToday ? 'rgba(59,130,246,0.06)' : isWeekend ? 'rgba(255,255,255,0.015)' : 'transparent',
                textAlign:'center',
              }}>
                <div style={{ fontSize: 10, color:'var(--text-mute)', textTransform:'uppercase' }}>{d.toLocaleDateString('en-GB',{weekday:'short'})}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: isToday?'var(--blue-bright)':'var(--text)' }}>{d.getDate()}</div>
                {isToday && <div style={{ fontSize: 9, color:'var(--blue-bright)' }}>today</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(14, 1fr)', minHeight: 380, position:'relative' }}>
          {days.map((d,i) => {
            const isWeekend = d.getDay()===0 || d.getDay()===6;
            return (
              <div key={i} style={{
                borderRight: i<13?'1px solid var(--line-soft)':'none',
                background: isWeekend ? 'rgba(255,255,255,0.015)' : 'transparent',
                padding: 6, display:'flex', flexDirection:'column', gap: 5,
              }}>
                {releases.filter(r => inDay(r, d)).map(r => (
                  <div key={r.id} onClick={() => onPick(r)}
                    style={{
                      background: REL_STATE_TONE[r.state].bg,
                      border: `1px solid ${REL_RISK_TONE[r.risk].border}`,
                      borderRadius: 4, padding:'5px 6px', cursor:'pointer',
                      borderLeft: `3px solid ${REL_RISK_TONE[r.risk].c}`,
                    }}>
                    <div className="mono" style={{ fontSize: 9, color:'var(--text-mute)' }}>{r.window.start.split(' · ')[1]}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 500, lineHeight: 1.25, marginTop: 2 }}>{r.title}</div>
                    <div style={{ fontSize: 9.5, color:'var(--text-mute)', marginTop: 1 }}>{r.workspace}</div>
                  </div>
                ))}
                {/* freeze overlay for quarter-end (28 May) */}
                {d.getDate() >= 28 && d.getMonth() === 4 && (
                  <div style={{
                    position:'absolute', top: 0, bottom: 0,
                    left: `${(i)*(100/14)}%`, width: `${(100/14)}%`,
                    background:'repeating-linear-gradient(45deg, rgba(245,158,11,0.06), rgba(245,158,11,0.06) 6px, transparent 6px, transparent 12px)',
                    pointerEvents:'none',
                  }}/>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:'flex', gap: 14, marginTop: 12, fontSize: 11, color:'var(--text-mute)' }}>
        <span>Border colour = risk band</span>
        <span style={{ display:'flex', alignItems:'center', gap: 5 }}>
          <span style={{ width: 12, height: 12, background:'repeating-linear-gradient(45deg, rgba(245,158,11,0.2), rgba(245,158,11,0.2) 4px, transparent 4px, transparent 8px)', border:'1px solid rgba(245,158,11,0.4)' }}/>
          freeze window
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// FREEZES

const FreezesView = () => (
  <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
    {FREEZES.map((f, i) => (
      <div key={i} className="card" style={{ padding: 16, borderLeft: '3px solid var(--amber)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap: 12 }}>
          <div>
            <div className="h-eyebrow" style={{ marginBottom: 4 }}>{f.kind} freeze</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{f.name}</div>
            <div style={{ fontSize: 12, color:'var(--text-dim)', marginTop: 6 }}>
              <span className="mono">{f.start}</span> → <span className="mono">{f.end}</span>
            </div>
            <div style={{ fontSize: 12, color:'var(--text-mute)', marginTop: 4 }}>Scope: {f.scope}</div>
          </div>
          <div style={{ display:'flex', gap: 8, alignItems:'flex-start' }}>
            <Btn size="sm" variant="ghost">Edit</Btn>
            <Btn size="sm" icon="alert">Request exception</Btn>
          </div>
        </div>
      </div>
    ))}
    <button style={{
      border:'1px dashed var(--line-strong)', borderRadius: 6, padding: 14, background:'transparent',
      color:'var(--text-mute)', fontSize: 12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
    }}>
      <Icon name="plus" size={13}/> Declare freeze window
    </button>
  </div>
);

// =============================================================================
// IMPACT RIBBON — visualises upstream/downstream

const ImpactRibbon = ({ r }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap: 8, alignItems:'center', minHeight: 70 }}>
    <div style={{ display:'flex', flexDirection:'column', gap: 4, alignItems:'flex-end' }}>
      <span className="h-eyebrow">Upstream depends on</span>
      {r.upstream.map(u => (
        <span key={u} className="mono" style={{ fontSize: 11, color:'var(--text-dim)', background:'var(--raised)', padding:'2px 7px', borderRadius: 3 }}>{u}</span>
      ))}
    </div>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap: 6 }}>
      <Icon name="arrow-right" size={13} style={{ color:'var(--text-mute)' }}/>
      <div style={{
        background:'var(--blue-bg)', border:'1px solid rgba(59,130,246,0.4)',
        padding:'6px 10px', borderRadius: 5, textAlign:'center', minWidth: 110,
      }}>
        <div className="mono" style={{ fontSize: 10, color:'var(--text-mute)' }}>release</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color:'#BFDBFE' }}>{r.services[0]}{r.services.length>1?` +${r.services.length-1}`:''}</div>
      </div>
      <Icon name="arrow-right" size={13} style={{ color:'var(--text-mute)' }}/>
    </div>
    <div style={{ display:'flex', flexDirection:'column', gap: 4, alignItems:'flex-start' }}>
      <span className="h-eyebrow">Downstream impacted</span>
      {r.downstream.map(d => (
        <span key={d} className="mono" style={{ fontSize: 11, color:'var(--text-dim)', background:'var(--raised)', padding:'2px 7px', borderRadius: 3 }}>{d}</span>
      ))}
    </div>
  </div>
);

// =============================================================================
// RELEASE DRAWER (right-side, full)

const ReleaseDrawer = ({ release, onClose, navigate }) => {
  const [tab, setTab] = uS_rel('overview');
  const tabs = [
    { id:'overview',  label:'Overview' },
    { id:'impact',    label:'Impact'  },
    { id:'comms',     label:'Comms' },
    { id:'approvals', label:'Approvals' },
    { id:'runbook',   label:'Runbook & rollback' },
    { id:'timeline',  label:'Timeline' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset: 0, background:'rgba(0,0,0,0.5)', zIndex: 50 }}/>
      <div style={{
        position:'fixed', top: 0, right: 0, bottom: 0, width: 760,
        background:'var(--bg)', borderLeft:'1px solid var(--line-strong)',
        zIndex: 51, display:'flex', flexDirection:'column',
        animation:'slideInRight 200ms ease-out',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--line)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display:'flex', gap: 8, alignItems:'center', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{release.id}</span>
                <StatePill state={release.state}/>
                <RiskPill risk={release.risk}/>
                <span className="chip blue">{release.project}</span>
                <span className="chip">{release.workspace}</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{release.title}</h2>
              <div style={{ fontSize: 12, color:'var(--text-dim)', marginTop: 6 }}>
                <span className="mono">{release.window.start}</span> → <span className="mono">{release.window.end}</span> · {release.duration} · <span style={{ color:'var(--text-mute)' }}>{release.window.tz}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-mute)', cursor:'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ display:'flex', gap: 6, marginTop: 12 }}>
            {release.state === 'scheduled' && <Btn variant="primary" icon="play">Start cutover</Btn>}
            {release.state === 'in-flight' && <Btn variant="primary" icon="arrow-right">Advance canary</Btn>}
            {release.state === 'in-flight' && <Btn icon="pause">Hold</Btn>}
            {release.state !== 'completed' && <Btn icon="branch">Rollback plan</Btn>}
            <Btn icon="bell">Notify stakeholders</Btn>
            <Btn variant="ghost" icon="link" onClick={() => navigate(`/project/${release.project}/dashboard`)}>Open project</Btn>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap: 4, padding:'0 20px', borderBottom:'1px solid var(--line)' }}>
          {tabs.map(t => (
            <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}
              style={{ borderBottom: tab===t.id?'2px solid var(--blue-bright)':'2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow:'auto', padding: 20 }}>
          {tab === 'overview'  && <OverviewTab r={release}/>}
          {tab === 'impact'    && <ImpactTab r={release}/>}
          {tab === 'comms'     && <CommsTab r={release}/>}
          {tab === 'approvals' && <ApprovalsTab r={release}/>}
          {tab === 'runbook'   && <RunbookTab r={release}/>}
          {tab === 'timeline'  && <TimelineTab r={release}/>}
        </div>
      </div>
    </>
  );
};

const FieldRow = ({ label, children }) => (
  <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap: 12, padding:'8px 0', borderTop:'1px solid var(--line-soft)', alignItems:'flex-start' }}>
    <div className="h-eyebrow" style={{ paddingTop: 2 }}>{label}</div>
    <div style={{ fontSize: 12.5, color:'var(--text)' }}>{children}</div>
  </div>
);

const OverviewTab = ({ r }) => (
  <div>
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
        <span className="h-eyebrow">Readiness</span>
        <span className="mono" style={{ fontSize: 11, color: r.progress===100?'var(--green)':'var(--blue-bright)' }}>{r.progress}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background:'var(--raised)', overflow:'hidden' }}>
        <div style={{ width:`${r.progress}%`, height:'100%', background: r.progress===100?'var(--green)':'#3B82F6' }}/>
      </div>
      {r.checks?.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 6, marginTop: 12 }}>
          {r.checks.map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 12 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: c.ok?'var(--green-bg)':'var(--raised)',
                border:`1px solid ${c.ok?'rgba(16,185,129,0.4)':'var(--line)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {c.ok && <Icon name="check" size={9} style={{ color:'var(--green)' }}/>}
              </span>
              <span style={{ color: c.ok?'var(--text-dim)':'var(--text)' }}>{c.l}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="card" style={{ padding: 14 }}>
      <FieldRow label="Owner">
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <Avatar name={r.owner.name} initials={r.owner.initials} size={20}/>
          {r.owner.name}
        </div>
      </FieldRow>
      <FieldRow label="Release manager">
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <Avatar name={r.rm.name} initials={r.rm.initials} size={20}/>
          {r.rm.name}
        </div>
      </FieldRow>
      <FieldRow label="Type">
        <span className="chip">{r.type}</span>
      </FieldRow>
      <FieldRow label="Services">
        <div style={{ display:'flex', flexWrap:'wrap', gap: 5 }}>
          {r.services.map(s => <span key={s} className="mono" style={{ fontSize: 11, color:'var(--blue-bright)', background:'var(--blue-bg)', padding:'2px 7px', borderRadius: 3 }}>{s}</span>)}
        </div>
      </FieldRow>
      <FieldRow label="Outage">
        {r.outage.kind === 'none' ? <span style={{ color:'var(--green)' }}>None — zero-downtime release</span> : (
          <div>
            <OutagePill outage={r.outage}/>
            <div style={{ marginTop: 4, color:'var(--text-dim)' }}>{r.outage.note}</div>
          </div>
        )}
      </FieldRow>
      <FieldRow label="Artifacts">
        <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
          {r.artifacts?.map((a,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 11.5 }}>
              <Icon name="branch" size={11} style={{ color:'var(--text-mute)' }}/>
              <span className="mono">{a.repo}</span>
              <span className="mono" style={{ color:'var(--text-mute)' }}>{a.sha}</span>
              <span className="chip">{a.tag}</span>
            </div>
          )) || <span style={{ color:'var(--text-mute)' }}>—</span>}
        </div>
      </FieldRow>
      {r.completedAt && (
        <FieldRow label="Completed">
          <span style={{ color:'var(--green)' }}>{r.completedAt}</span>
        </FieldRow>
      )}
      {r.incidentNote && (
        <FieldRow label="Incident note">
          <span style={{ color:'var(--text-dim)' }}>{r.incidentNote}</span>
        </FieldRow>
      )}
    </div>
  </div>
);

const ImpactTab = ({ r }) => (
  <div>
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div className="h-eyebrow" style={{ marginBottom: 14 }}>Service graph slice</div>
      <ImpactRibbon r={r}/>
    </div>
    <div className="card" style={{ padding: 14 }}>
      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Downstream — owners to notify</div>
      {r.downstream.map((d, i) => (
        <div key={d} style={{ display:'grid', gridTemplateColumns:'180px 1fr 100px', gap: 10, padding:'8px 0', borderTop: i?'1px solid var(--line-soft)':'none', alignItems:'center', fontSize: 12 }}>
          <span className="mono" style={{ fontSize: 11.5, color:'var(--blue-bright)' }}>{d}</span>
          <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <Avatar name={['Lila Chen','Tom West','Naomi K.','Ravi P.','Bea Marchetti'][i%5]} size={18}/>
            <span style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{['Lila Chen','Tom West','Naomi K.','Ravi P.','Bea Marchetti'][i%5]}</span>
          </div>
          <span style={{ fontSize: 11, color: i===0?'var(--amber)':'var(--green)' }}>{i===0?'pending ack':'acknowledged'}</span>
        </div>
      ))}
    </div>
  </div>
);

const CommsTab = ({ r }) => {
  const events = [
    { t:'T-72h', kind:'announce',   ch:'#release-board, status-page', state: r.notifications.sent>0?'sent':'queued', note:'Initial announce — windows, services, expected user impact' },
    { t:'T-24h', kind:'reminder',   ch:'#csp-v2, partner email',      state: r.state==='scheduled'?'queued':'sent',   note:'Reminder + final readiness summary' },
    { t:'T-0',   kind:'starting',   ch:'all subscribed',              state: r.state==='in-flight'||r.state==='completed'?'sent':'queued', note:'Cutover starting — read-only banner up' },
    { t:'T+90m', kind:'completed',  ch:'all subscribed',              state: r.state==='completed'?'sent':'queued', note:'Cutover complete · 0 incidents' },
  ];
  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
          <div className="h-eyebrow">Channels subscribed</div>
          <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.notifications.sent} notifications sent</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap: 5 }}>
          {r.notifications.channels?.length ? r.notifications.channels.map(c => (
            <span key={c} className="mono" style={{ fontSize: 11, color:'var(--text-dim)', background:'var(--raised)', padding:'2px 7px', borderRadius: 3 }}>{c}</span>
          )) : <span style={{ fontSize: 12, color:'var(--text-mute)' }}>No channels yet — add subscribers when CAB approves.</span>}
        </div>
        {r.notifications.next && <div style={{ marginTop: 10, fontSize: 11.5, color:'var(--text-mute)' }}>Next scheduled: {r.notifications.next}</div>}
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--line)' }}>
          <div className="h-eyebrow">Communication plan</div>
        </div>
        {events.map((e,i) => (
          <div key={i} style={{ padding:'12px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'70px 100px 1fr 90px', gap: 12, alignItems:'center' }}>
            <span className="mono" style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{e.t}</span>
            <span className="chip">{e.kind}</span>
            <div>
              <div style={{ fontSize: 12 }}>{e.note}</div>
              <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{e.ch}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 600, padding:'2px 6px', borderRadius: 3,
              background: e.state==='sent'?'var(--green-bg)':'var(--raised)',
              color: e.state==='sent'?'#86EFAC':'var(--text-mute)',
              textTransform:'uppercase', justifySelf:'start',
            }}>{e.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ApprovalsTab = ({ r }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    {r.approvers.map((a, i) => (
      <div key={i} style={{ padding:'14px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'40px 1fr 110px', gap: 12, alignItems:'center' }}>
        <Avatar name={a.name} initials={a.initials} size={32}/>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{a.role}</div>
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 600, padding:'3px 8px', borderRadius: 3,
          background: a.state==='approved'?'var(--green-bg)':'var(--amber-bg)',
          color: a.state==='approved'?'#86EFAC':'#FCD34D',
          textTransform:'uppercase', justifySelf:'start',
        }}>{a.state}</span>
      </div>
    ))}
  </div>
);

const RunbookTab = ({ r }) => (
  <div>
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
        <div className="h-eyebrow">Runbook</div>
        <Btn size="sm" variant="ghost" iconRight="arrow-right">Open in wiki</Btn>
      </div>
      <div className="mono" style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{r.runbook || '—'}</div>
    </div>
    <div className="card" style={{ padding: 14, borderLeft:'3px solid var(--amber)' }}>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Rollback plan</div>
      <div style={{ fontSize: 13 }}>{r.rollback || 'No rollback plan documented.'}</div>
    </div>
  </div>
);

const TimelineTab = ({ r }) => {
  const events = [
    { t:'2 days ago', who:'Sarah Chen', what:'Created release ticket' },
    { t:'2 days ago', who:'Polaris',    what:'Auto-detected upstream dependencies (3) and downstream impact (5)' },
    { t:'1 day ago',  who:'Priya Shah', what:'Approved — eng director' },
    { t:'1 day ago',  who:'Marcus Webb',what:'Approved — CISO' },
    { t:'18h ago',    who:'System',     what:'Comms plan generated · T-24h reminder queued' },
    { t:'12h ago',    who:'Critic',     what:'Flagged: visual regression baseline missing for 2 components — resolved' },
    { t:'now',        who:'CAB',        what:'Reviewing', state:'pending' },
  ];
  return (
    <div className="card" style={{ padding: 16 }}>
      {events.map((e, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:'90px 14px 1fr', gap: 12, padding:'8px 0', borderTop: i?'1px solid var(--line-soft)':'none', alignItems:'flex-start' }}>
          <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{e.t}</span>
          <span style={{ width: 9, height: 9, borderRadius: 5, background: e.state==='pending'?'var(--amber)':'var(--green)', marginTop: 4 }}/>
          <div>
            <div style={{ fontSize: 12.5 }}>{e.what}</div>
            <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>{e.who}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// PLAN RELEASE MODAL — used both top-level and from project view (?new=1)

const PlanReleaseModal = ({ onClose, navigate, project }) => {
  const [step, setStep] = uS_rel(0);
  const [form, setForm] = uS_rel({
    title: '',
    project: project?.id || '',
    risk: 'medium',
    type: 'standard',
    date: '',
    time: '22:00',
    duration: '60',
    outage: 'none',
    services: '',
    notify: ['#release-board'],
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const steps = ['Basics','Window & impact','Approvals & comms','Review'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 720, maxHeight:'85vh', background:'var(--surface)',
        border:'1px solid var(--line-strong)', borderRadius: 10,
        boxShadow:'0 30px 80px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column',
      }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div className="h-eyebrow" style={{ marginBottom: 2 }}>Plan release</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{steps[step]}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text-mute)', cursor:'pointer', fontSize: 18 }}>×</button>
        </div>

        {/* Stepper */}
        <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--line)', display:'flex', gap: 4 }}>
          {steps.map((s,i) => (
            <div key={s} style={{ flex:1, display:'flex', flexDirection:'column', gap: 4 }}>
              <div style={{
                height: 3, borderRadius: 2,
                background: i <= step ? 'var(--blue-bright)' : 'var(--line)',
              }}/>
              <span style={{ fontSize: 10.5, color: i===step?'var(--text)':'var(--text-mute)' }}>{i+1}. {s}</span>
            </div>
          ))}
        </div>

        <div style={{ flex:1, overflow:'auto', padding: 18 }}>
          {step === 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <Field label="Release title" hint="e.g. CSP v2 — Wave 1 cutover">
                <input value={form.title} onChange={e=>set('title', e.target.value)} className="ti"/>
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
                <Field label="Project">
                  <select className="ti" value={form.project} onChange={e=>set('project', e.target.value)}>
                    <option value="">— choose —</option>
                    <option value="csp-v2">csp-v2</option>
                    <option value="fraud-uplift">fraud-uplift</option>
                    <option value="snowflake-ingest">snowflake-ingest</option>
                    <option value="identity">identity</option>
                  </select>
                </Field>
                <Field label="Type">
                  <select className="ti" value={form.type} onChange={e=>set('type', e.target.value)}>
                    <option>standard</option>
                    <option>major</option>
                    <option>hotfix</option>
                    <option>data-migration</option>
                  </select>
                </Field>
              </div>
              <Field label="Risk band" hint="High = needs CAB. Medium = needs eng director + domain. Low = automated.">
                <div style={{ display:'flex', gap: 6 }}>
                  {['low','medium','high'].map(r => (
                    <button key={r} onClick={()=>set('risk', r)} style={{
                      flex:1, padding:'8px 12px', borderRadius: 4,
                      background: form.risk===r ? REL_RISK_TONE[r].bg : 'var(--raised)',
                      border: `1px solid ${form.risk===r ? REL_RISK_TONE[r].border : 'var(--line)'}`,
                      color: form.risk===r ? REL_RISK_TONE[r].c : 'var(--text-dim)',
                      fontSize: 12, fontWeight: 600, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.05em',
                    }}>{r}</button>
                  ))}
                </div>
              </Field>
              <div className="card" style={{ padding: 12, background:'var(--purple-bg)', border:'1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ display:'flex', gap: 8, alignItems:'flex-start' }}>
                  <Icon name="sparkle" size={13} style={{ color:'var(--purple)', marginTop: 2 }}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color:'#DDD6FE', marginBottom: 4 }}>Polaris will infer the rest</div>
                    <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>
                      Once you pick a project, Polaris reads its spec, recent commits, and the Constitution's service graph to draft the impact analysis, runbook draft, and stakeholder list. You'll review before scheduling.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12 }}>
                <Field label="Date"><input type="date" className="ti" value={form.date} onChange={e=>set('date', e.target.value)}/></Field>
                <Field label="Start time (UTC)"><input type="time" className="ti" value={form.time} onChange={e=>set('time', e.target.value)}/></Field>
                <Field label="Duration (min)"><input type="number" className="ti" value={form.duration} onChange={e=>set('duration', e.target.value)}/></Field>
              </div>
              <Field label="Outage profile">
                <div style={{ display:'flex', gap: 6 }}>
                  {[
                    { v:'none',     l:'Zero downtime', d:'Canary or feature-flag' },
                    { v:'partial',  l:'Partial',       d:'Some endpoints degraded' },
                    { v:'full',     l:'Full',          d:'Service unavailable' },
                  ].map(o => (
                    <button key={o.v} onClick={()=>set('outage', o.v)} style={{
                      flex:1, padding:'10px 12px', borderRadius: 4, textAlign:'left',
                      background: form.outage===o.v ? 'var(--blue-bg)' : 'var(--raised)',
                      border: `1px solid ${form.outage===o.v ? 'rgba(59,130,246,0.4)' : 'var(--line)'}`,
                      color: 'var(--text)', cursor:'pointer',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{o.l}</div>
                      <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{o.d}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Services to release" hint="Polaris will compute upstream/downstream from the Constitution's C4 graph">
                <input value={form.services} onChange={e=>set('services', e.target.value)} className="ti" placeholder="portal-bff, session-svc"/>
              </Field>
              <div className="card" style={{ padding: 12, background:'var(--amber-bg)', border:'1px solid rgba(245,158,11,0.3)' }}>
                <div style={{ display:'flex', gap: 8 }}>
                  <Icon name="alert" size={13} style={{ color:'var(--amber)', marginTop: 2 }}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color:'#FCD34D' }}>Heads up</div>
                    <div style={{ fontSize: 11.5, color:'var(--text-dim)', marginTop: 2 }}>
                      Your selected window overlaps with <span style={{ fontWeight:600 }}>Quarter-end close</span> if pushed past 28 May. Risk band <span style={{ fontWeight:600 }}>{form.risk}</span> requires {form.risk==='high'?'CAB':'eng director + domain'} approval.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
              <Field label="Approvers (auto-routed by risk)">
                <div className="card" style={{ padding: 0, overflow:'hidden' }}>
                  {[
                    { name:'Priya Shah', role:'Eng director', auto:true },
                    { name:'Marcus Webb', role:'CISO', auto: form.risk==='high' },
                    { name:'Lila Nakamura', role:'CAB chair', auto: form.risk==='high' },
                  ].map((a,i) => (
                    <div key={i} style={{ padding:'10px 12px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'30px 1fr 90px', gap: 10, alignItems:'center' }}>
                      <Avatar name={a.name} size={22}/>
                      <div>
                        <div style={{ fontSize: 12.5 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{a.role}</div>
                      </div>
                      <span style={{ fontSize: 10.5, color: a.auto?'var(--blue-bright)':'var(--text-mute)' }}>{a.auto?'required':'optional'}</span>
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Stakeholders to notify">
                <div style={{ display:'flex', flexWrap:'wrap', gap: 5, padding:'4px 0' }}>
                  {['#release-board','#csp-v2','status-page','partner-api owners','mobile-app team','#analytics'].map((c,i) => {
                    const on = form.notify.includes(c) || i < 3;
                    return (
                      <span key={c} className="mono" style={{
                        fontSize: 11, padding:'3px 8px', borderRadius: 3,
                        background: on?'var(--blue-bg)':'var(--raised)',
                        color: on?'#BFDBFE':'var(--text-mute)',
                        border: `1px solid ${on?'rgba(59,130,246,0.4)':'var(--line)'}`,
                        cursor:'pointer',
                      }}>{c}</span>
                    );
                  })}
                </div>
              </Field>
              <Field label="Comms cadence">
                {[
                  { l:'T-72h announce', on:true },
                  { l:'T-24h reminder', on:true },
                  { l:'T-0 starting',   on:true },
                  { l:'Stage-by-stage canary updates', on: form.outage==='none' },
                  { l:'Post-mortem if rolled back',    on:true },
                ].map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding:'4px 0' }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: c.on?'var(--green-bg)':'var(--raised)',
                      border:`1px solid ${c.on?'rgba(16,185,129,0.4)':'var(--line)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>{c.on && <Icon name="check" size={9} style={{ color:'var(--green)' }}/>}</span>
                    <span style={{ fontSize: 12, color: c.on?'var(--text)':'var(--text-mute)' }}>{c.l}</span>
                  </div>
                ))}
              </Field>
            </div>
          )}

          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
              <div className="card" style={{ padding: 14 }}>
                <div className="h-eyebrow" style={{ marginBottom: 8 }}>Summary</div>
                <FieldRow label="Title">{form.title || <span style={{ color:'var(--text-mute)' }}>—</span>}</FieldRow>
                <FieldRow label="Project">{form.project || '—'}</FieldRow>
                <FieldRow label="Risk"><RiskPill risk={form.risk}/></FieldRow>
                <FieldRow label="Window">{form.date || '—'} {form.time} UTC · {form.duration}m</FieldRow>
                <FieldRow label="Outage">{form.outage}</FieldRow>
                <FieldRow label="Services">{form.services || '—'}</FieldRow>
                <FieldRow label="Approvers">{form.risk==='high'?'Eng director + CISO + CAB':'Eng director + domain'}</FieldRow>
              </div>
              <div className="card" style={{ padding: 12, background:'var(--purple-bg)', border:'1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ display:'flex', gap: 8, alignItems:'flex-start' }}>
                  <Icon name="sparkle" size={13} style={{ color:'var(--purple)', marginTop: 2 }}/>
                  <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>
                    On submit, Polaris will draft a runbook from <span className="mono" style={{ color:'#DDD6FE' }}>wiki/runbooks/template.md</span>, generate the rollback plan from the project's deploy history, and queue notifications. You'll review the draft before it goes live.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <div style={{ display:'flex', gap: 6 }}>
            {step > 0 && <Btn icon="chevron-left" onClick={() => setStep(s => s-1)}>Back</Btn>}
            {step < steps.length - 1 && <Btn variant="primary" iconRight="chevron-right" onClick={() => setStep(s => s+1)}>Continue</Btn>}
            {step === steps.length - 1 && <Btn variant="primary" icon="check" onClick={() => { onClose(); navigate('/releases'); }}>Schedule release</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
    <span className="h-eyebrow">{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{hint}</span>}
  </div>
);

// =============================================================================

window.ReleasesScreen = ReleasesScreen;
window.PlanReleaseModal = PlanReleaseModal;

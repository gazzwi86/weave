/* global React, Icon, Btn, Avatar, Bar, FIXTURES */
const { useState: uS_pol2 } = React;

const POL_META_PROPOSALS = [
  { id:'PL-2026-05-05-031', kind:'PROMPT', title:'Spec Agent: tighten "out of scope" elicitation when domain count > 2', evidence:['12 specs in last 14d had ambiguous scope flagged at HITL','Critic agent fired "scope creep" warning 9× on these','User sentiment dropped to 0.42 on follow-up sessions'], delta:'+0.18 spec satisfaction (est)', cost:'~+1.2k tokens / spec', confidence:'high', status:'pending' },
  { id:'PL-2026-05-05-018', kind:'WORKFLOW', title:'Skip Critic loop on tasks with prior reviewer approval within 24h', evidence:['Critic re-runs added 7.4m median latency','94% of repeats produced no new findings','Cost: $43/day in unused inference'], delta:'-7.4m median latency · -$1.3k/mo', cost:'-tokens', confidence:'medium', status:'pending' },
  { id:'PL-2026-05-04-009', kind:'RULE', title:'Block auto-merge when audit chain has unverified entries in last 1h', evidence:['2 incidents traced to merges during chain-verify gaps','Compliance flagged this as SOC2 risk','Risk: 0 → low'], delta:'compliance hardening', cost:'≤2 merges/day held briefly', confidence:'high', status:'experiment' },
  { id:'PL-2026-05-04-002', kind:'CONTEXT', title:'Spec Agent: pull related ADRs into context window (currently misses)', evidence:['8 of 14 specs missed prior ADR decisions','Reviewer override rate 38% on those','Decisions tab has 142 unread by agent'], delta:'+12% first-pass approval', cost:'+800 tokens / spec', confidence:'medium', status:'pending' },
  { id:'PL-2026-05-03-014', kind:'MODEL', title:'Route trivial wiki-edits to Haiku (currently Sonnet)', evidence:['Quality parity at 99.1% on 200-sample audit','Latency 4.2× faster','Cost: -$220/mo'], delta:'-$220/mo · -3.1s p50', cost:'-tokens', confidence:'high', status:'pending' },
  { id:'PL-2026-05-02-007', kind:'TOOL', title:'Add `org_graph_search` tool to Snappy (currently uses generic search)', evidence:['7 sessions where agent failed to find existing capability','3 duplicate proposals rejected by Council','Search precision: 0.41'], delta:'+precision, fewer dupes', cost:'tool boilerplate', confidence:'high', status:'pending' },
  { id:'PL-2026-05-01-022', kind:'PROMPT', title:'Tech-Writer: cite source code line for every wiki claim', evidence:['11 wiki pages drifted from code','Reader sentiment "trustworthy" dropped 0.62→0.51','Audit found 4 inaccurate descriptions'], delta:'+wiki accuracy', cost:'+400 tokens / page', confidence:'high', status:'pending' },
];

const POL_KIND_TONE = {
  PROMPT:   { c:'#BFDBFE', bg:'rgba(59,130,246,0.15)' },
  WORKFLOW: { c:'#A7F3D0', bg:'rgba(16,185,129,0.15)' },
  RULE:     { c:'#FCD34D', bg:'rgba(245,158,11,0.15)' },
  CONTEXT:  { c:'#DDD6FE', bg:'rgba(139,92,246,0.15)' },
  MODEL:    { c:'#F9A8D4', bg:'rgba(236,72,153,0.15)' },
  TOOL:     { c:'#FCA5A5', bg:'rgba(239,68,68,0.15)' },
};

const PolarisScreen = ({ navigate }) => {
  const [tab, setTab] = uS_pol2('proposals');
  const tabs = [
    { id:'proposals', label:'Proposals',    icon:'sparkle', count: POL_META_PROPOSALS.length },
    { id:'logs',      label:'Raw logs',     icon:'terminal' },
    { id:'sentiment', label:'Sentiment',    icon:'heart' },
    { id:'quality',   label:'Quality',      icon:'check-circle' },
  ];

  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="Self-improvement · meta layer"
        icon="sparkle"
        title="Polaris — improve Blushift itself"
        subtitle="Continuously-running observability over the harness. Watches sessions, sentiment, errors, retries, and proposes prompt/workflow/rule edits."
        role="The reflexive loop. Polaris is to Blushift what Blushift is to your engineering org — a background agent watching for ways the system can do its own work better."
        purpose="Triage proposed edits to prompts, workflows, rules, models, and tools. Read raw logs, sentiment, and quality metrics that drive each proposal."
        contributes="Closes the loop. Without Polaris, the harness is static; with it, every weak signal (low sentiment, retries, override rate) becomes a candidate improvement."
      />

      <div style={{ display:'flex', gap: 4, borderBottom:'1px solid var(--line)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}
            style={{ borderRadius:'4px 4px 0 0', borderBottom: tab === t.id ? '2px solid var(--blue-bright)' : '2px solid transparent' }}>
            <Icon name={t.icon} size={13}/> {t.label}
            {t.count != null && <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 8, background:'var(--purple-bg)', color:'#DDD6FE' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'proposals' && <ProposalsTab/>}
      {tab === 'logs' && <LogsTab/>}
      {tab === 'sentiment' && <SentimentTab/>}
      {tab === 'quality' && <QualityTab/>}
    </div>
  );
};

const ProposalsTab = () => {
  const [filter, setFilter] = uS_pol2('All');
  const [dispatched, setDispatched] = uS_pol2({});
  const filters = ['All','Prompt','Workflow','Rule','Context','Model','Tool'];
  const list = POL_META_PROPOSALS.filter(p => filter === 'All' || p.kind === filter.toUpperCase());

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 14 }}>
        <div style={{ display:'flex', gap: 6 }}>
          {filters.map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn icon="filter" variant="ghost" size="sm">Filter</Btn>
          <Btn icon="sparkle">Run discovery now</Btn>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
        {list.map(p => {
          const tone = POL_KIND_TONE[p.kind];
          const state = dispatched[p.id];
          return (
            <div key={p.id} className="card" style={{ padding: 16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap: 14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{p.id}</span>
                    <span style={{ fontSize: 9.5, fontWeight:600, padding:'1px 6px', borderRadius:3, background: tone.bg, color: tone.c, textTransform:'uppercase', letterSpacing:'0.05em' }}>{p.kind}</span>
                    {p.status === 'experiment' && <span className="chip blue">A/B running</span>}
                    <span style={{ fontSize: 11, color:'var(--text-mute)' }}>· confidence {p.confidence}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>{p.title}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14, marginBottom: 12 }}>
                    <div>
                      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Evidence</div>
                      {p.evidence.map((e,i) => (
                        <div key={i} style={{ fontSize: 12, color:'var(--text-dim)', paddingLeft: 12, position:'relative', marginBottom: 3 }}>
                          <span style={{ position:'absolute', left:0, color:'var(--blue-bright)' }}>·</span>{e}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Expected impact</div>
                      <div style={{ fontSize: 12.5, color:'var(--green)', marginBottom: 4 }}>{p.delta}</div>
                      <div className="h-eyebrow" style={{ marginTop: 10, marginBottom: 6 }}>Cost</div>
                      <div className="mono" style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{p.cost}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap: 6, minWidth: 130 }}>
                  {state === 'applied' ? (
                    <span className="chip green">✓ Applied</span>
                  ) : state === 'experiment' ? (
                    <span className="chip blue">Experiment running</span>
                  ) : (
                    <>
                      <Btn variant="primary" icon="check" onClick={() => setDispatched(d => ({ ...d, [p.id]: 'applied' }))}>Apply</Btn>
                      <Btn icon="sparkle" onClick={() => setDispatched(d => ({ ...d, [p.id]: 'experiment' }))}>A/B test</Btn>
                      <Btn variant="ghost" size="sm">Dismiss</Btn>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const POL_LOGS = [
  { t:'04:12:08.221', sev:'INFO',  agent:'spec-agent',  proj:'csp-v2',          msg:'Generated brief draft (1.2k tokens, 2.1s)' },
  { t:'04:12:09.012', sev:'WARN',  agent:'critic',      proj:'csp-v2',          msg:'Spec section "out of scope" empty — flagged for review' },
  { t:'04:12:11.443', sev:'INFO',  agent:'tech-writer', proj:'fraud-uplift',    msg:'Wiki page portal-bff updated (32 lines changed)' },
  { t:'04:12:14.092', sev:'ERROR', agent:'engineer',    proj:'csp-v2',          msg:'Tool call `run_tests` timed out after 90s — retry 1/3' },
  { t:'04:12:18.331', sev:'INFO',  agent:'engineer',    proj:'csp-v2',          msg:'Tool call `run_tests` retry 1 succeeded (47s)' },
  { t:'04:12:21.802', sev:'INFO',  agent:'orchestrator',proj:'snowflake-ingest',msg:'Phase transition: Implementation → Demo' },
  { t:'04:12:24.119', sev:'WARN',  agent:'spec-agent',  proj:'fraud-uplift',    msg:'Context window 72% full — pruning oldest 8 messages' },
  { t:'04:12:27.554', sev:'INFO',  agent:'reviewer',    proj:'csp-v2',          msg:'PR #4218 approved (overrode 1 of 3 critic findings)' },
  { t:'04:12:31.018', sev:'ERROR', agent:'tech-writer', proj:'fraud-uplift',    msg:'Org graph node lookup failed: capability=adjudication not found' },
  { t:'04:12:34.211', sev:'INFO',  agent:'polaris',     proj:'meta',            msg:'New proposal generated: PL-2026-05-05-031 (PROMPT)' },
];

const POL_SEV_TONE = {
  INFO:  { c:'var(--text-dim)' },
  WARN:  { c:'#FCD34D' },
  ERROR: { c:'#FCA5A5' },
};

const LogsTab = () => {
  const [sev, setSev] = uS_pol2('All');
  const [agent, setAgent] = uS_pol2('All');
  const sevs = ['All','INFO','WARN','ERROR'];
  const agents = ['All','spec-agent','critic','tech-writer','engineer','orchestrator','reviewer','polaris'];
  const list = POL_LOGS.filter(l => (sev==='All'||l.sev===sev) && (agent==='All'||l.agent===agent));

  return (
    <div>
      <div style={{ display:'flex', gap: 12, marginBottom: 12, alignItems:'center' }}>
        <div style={{ display:'flex', gap: 6 }}>{sevs.map(s => <button key={s} className={`tab ${sev===s?'active':''}`} onClick={() => setSev(s)}>{s}</button>)}</div>
        <select className="inp" style={{ height: 28, fontSize: 12 }} value={agent} onChange={e => setAgent(e.target.value)}>
          {agents.map(a => <option key={a}>{a}</option>)}
        </select>
        <div style={{ marginLeft:'auto', fontSize: 11, color:'var(--text-mute)' }}>Showing {list.length} of 12,847 entries · last hour</div>
        <Btn icon="download" variant="ghost" size="sm">Export</Btn>
      </div>
      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ background:'#08101A', padding: '8px 14px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'120px 70px 130px 140px 1fr', gap: 10, fontSize: 10, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
          <span>Timestamp</span><span>Sev</span><span>Agent</span><span>Project</span><span>Message</span>
        </div>
        {list.map((l, i) => (
          <div key={i} style={{ padding: '6px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'120px 70px 130px 140px 1fr', gap: 10, fontSize: 11.5, fontFamily:'var(--mono)' }}>
            <span style={{ color:'var(--text-mute)' }}>{l.t}</span>
            <span style={{ color: POL_SEV_TONE[l.sev].c, fontWeight: 600 }}>{l.sev}</span>
            <span style={{ color:'var(--blue-bright)' }}>{l.agent}</span>
            <span style={{ color:'var(--text-dim)' }}>{l.proj}</span>
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const POL_SENTIMENT_SESSIONS = [
  { id:'S-9412', user:'Maya Patel',  proj:'fraud-uplift',  duration:'42m', score: 0.91, signal:'Approved spec first pass; "exactly what I needed"' },
  { id:'S-9411', user:'Sarah Chen',  proj:'csp-v2',        duration:'1h 12m', score: 0.62, signal:'2 retries on test generation; "this isn\'t quite right"' },
  { id:'S-9410', user:'Robin Lee',   proj:'fraud-uplift',  duration:'18m', score: 0.78, signal:'Minor friction on threshold negotiation' },
  { id:'S-9409', user:'Chris Okafor',proj:'snowflake-ingest', duration:'56m', score: 0.84, signal:'Smooth; one clarifying question' },
  { id:'S-9408', user:'Sarah Chen',  proj:'csp-v2',        duration:'2h 04m', score: 0.34, signal:'Multiple frustration phrases; cancelled and re-ran with different approach' },
  { id:'S-9407', user:'Maya Patel',  proj:'fraud-uplift',  duration:'31m', score: 0.88, signal:'Positive throughout' },
];

const SentimentTab = () => {
  const avg = (POL_SENTIMENT_SESSIONS.reduce((s,x) => s + x.score, 0) / POL_SENTIMENT_SESSIONS.length).toFixed(2);
  const low = POL_SENTIMENT_SESSIONS.filter(s => s.score < 0.5).length;
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <PlrStat label="Avg sentiment (7d)" value={avg} sub="↑ 0.04 vs prior week" tone="green"/>
        <PlrStat label="Sessions analysed" value="148" sub="last 7 days"/>
        <PlrStat label="Low-sentiment sessions" value={low} sub="< 0.5 score" tone={low > 0 ? 'amber' : 'green'}/>
        <PlrStat label="Auto-flagged for Polaris" value="3" sub="became proposals"/>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Sentiment trend (last 14 days)</div>
        <SentimentSpark/>
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ background:'var(--surface)', padding: '10px 16px', borderBottom:'1px solid var(--line)', fontSize: 12, fontWeight: 600 }}>Recent sessions</div>
        {POL_SENTIMENT_SESSIONS.map((s, i) => (
          <div key={s.id} style={{ padding: '12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'90px 160px 130px 80px 1fr 100px', gap: 14, alignItems:'center' }}>
            <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.id}</span>
            <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <Avatar name={s.user} size={20}/>
              <span style={{ fontSize: 12 }}>{s.user}</span>
            </div>
            <span className="chip">{s.proj}</span>
            <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.duration}</span>
            <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{s.signal}</span>
            <ScoreBar score={s.score}/>
          </div>
        ))}
      </div>
    </div>
  );
};

const SentimentSpark = () => {
  const data = [0.71, 0.74, 0.69, 0.78, 0.82, 0.61, 0.55, 0.68, 0.79, 0.84, 0.81, 0.77, 0.80, 0.79];
  const W = 760, H = 80, P = 6;
  const max = 1, min = 0.3;
  const pts = data.map((v,i) => [P + i * ((W - 2*P) / (data.length-1)), H - P - ((v-min)/(max-min)) * (H - 2*P)]);
  const path = pts.map((p,i) => (i?'L':'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      <line x1={P} y1={H - P - ((0.5-min)/(max-min))*(H-2*P)} x2={W-P} y2={H - P - ((0.5-min)/(max-min))*(H-2*P)} stroke="rgba(245,158,11,0.3)" strokeDasharray="3 3"/>
      <path d={`${path} L ${W-P},${H-P} L ${P},${H-P} Z`} fill="rgba(59,130,246,0.12)"/>
      <path d={path} stroke="#60A5FA" strokeWidth="1.5" fill="none"/>
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={data[i] < 0.5 ? 3 : 2} fill={data[i] < 0.5 ? '#FCD34D' : '#60A5FA'}/>)}
    </svg>
  );
};

const PlrStat = ({ label, value, sub, tone }) => (
  <div className="card" style={{ padding: 14 }}>
    <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)' : 'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color:'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
  </div>
);

const ScoreBar = ({ score }) => {
  const tone = score >= 0.7 ? '#10B981' : score >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background:'var(--raised)', borderRadius: 3, overflow:'hidden' }}>
        <div style={{ width: `${score*100}%`, height:'100%', background: tone }}/>
      </div>
      <span className="mono" style={{ fontSize: 11, color: tone, minWidth: 30 }}>{score.toFixed(2)}</span>
    </div>
  );
};

const QualityTab = () => {
  const metrics = [
    { name:'Spec satisfaction',     value:0.84, target:0.85, n:'128 specs', trend:'+0.03' },
    { name:'Spec completeness',     value:0.91, target:0.90, n:'128 specs', trend:'+0.01' },
    { name:'Spec correctness',      value:0.79, target:0.85, n:'128 specs', trend:'-0.02', alert: true },
    { name:'Spec accuracy (post-hoc)', value:0.72, target:0.80, n:'42 demos', trend:'+0.04', alert: true },
    { name:'Code review pass rate', value:0.88, target:0.85, n:'412 PRs', trend:'+0.02' },
    { name:'Test pass rate',        value:0.94, target:0.95, n:'412 PRs', trend:'+0.01' },
    { name:'Reviewer override rate', value:0.18, target:'< 0.20', n:'412 PRs', trend:'-0.03', invert:true },
    { name:'Hallucination flag rate', value:0.02, target:'< 0.05', n:'all sessions', trend:'-0.01', invert:true },
  ];
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {metrics.slice(0, 4).map(m => <QualityCard key={m.name} m={m}/>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        {metrics.slice(4).map(m => <QualityCard key={m.name} m={m}/>)}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Where quality is slipping</div>
        {[
          { area:'Spec correctness', cause:'Spec Agent missing prior ADRs in context', proposal:'PL-2026-05-04-002' },
          { area:'Spec accuracy (post-hoc)', cause:'Demo evidence not fed back into next-spec context', proposal:null },
          { area:'Tech wiki accuracy', cause:'Tech-Writer not citing source code', proposal:'PL-2026-05-01-022' },
        ].map((s,i) => (
          <div key={i} style={{ padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'200px 1fr 160px', gap:14, fontSize: 12.5 }}>
            <span style={{ color:'var(--amber)' }}>{s.area}</span>
            <span style={{ color:'var(--text-dim)' }}>{s.cause}</span>
            <span>{s.proposal ? <span className="chip blue">{s.proposal}</span> : <span style={{ fontSize: 11, color:'var(--text-mute)' }}>No proposal yet</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const QualityCard = ({ m }) => {
  const target = typeof m.target === 'number' ? m.target : 0;
  const ok = m.invert ? m.value <= target : m.value >= target;
  const tone = ok ? '#10B981' : '#F59E0B';
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>{m.name}</div>
      <div style={{ display:'flex', alignItems:'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 600, color: tone }}>{(m.value*100).toFixed(0)}%</span>
        <span style={{ fontSize: 11, color: m.trend.startsWith('-') === m.invert ? 'var(--green)' : 'var(--amber)' }}>{m.trend}</span>
      </div>
      <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 4 }}>target: {typeof m.target === 'number' ? `${(m.target*100).toFixed(0)}%` : m.target} · {m.n}</div>
    </div>
  );
};

window.PolarisScreen = PolarisScreen;

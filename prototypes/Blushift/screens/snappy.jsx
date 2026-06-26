/* global React, Icon, Avatar, Btn, FIXTURES */
const { useState: uS_sn, useMemo: uM_sn, useEffect: uE_sn } = React;

// ─────────────────────────────────────────────────────────────────────────
// SNAPPY — operations console + new-operation composer.
// LEFT  : prior operations list (active filter), with selectable item
// CENTER: new request composer OR detailed operation viewer
// RIGHT : context (workspace/project/initiative + business case) on new,
//         or generated artefacts + Polaris findings on existing
// ─────────────────────────────────────────────────────────────────────────

// Parse hash query (#/snappy?project=foo&op=bar)
const parseSnappyQuery = () => {
  const h = window.location.hash || '';
  const q = h.includes('?') ? h.split('?')[1] : '';
  const out = {};
  q.split('&').filter(Boolean).forEach(kv => {
    const [k, v] = kv.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  return out;
};

// ——— FIXTURES ———

const SNP_OPERATIONS = [
  { id:'OP-2026-05-08-014', title:'Motor Fast-Track Claims Service — spec proposal', status:'awaiting-review', actor:'Maya Patel', agent:'spec-agent', started:'2026-05-08 09:14', duration:'4m 22s', workspace:'fraud-claims', project:null, initiative:'lending-modernisation', tokens:'34.2k', cost:'$1.18', repos:['claims-svc','adjud-engine'], filesChanged:0, filesGenerated:3, polarisFindings:2 },
  { id:'OP-2026-05-08-009', title:'Refactor portal-bff auth middleware', status:'running', actor:'Maya Patel', agent:'engineer', started:'2026-05-08 08:51', duration:'17m 04s · running', workspace:'customer-portal', project:'csp-v2', initiative:null, tokens:'112k', cost:'$3.92', repos:['portal-bff'], filesChanged:14, filesGenerated:2, polarisFindings:1 },
  { id:'OP-2026-05-08-002', title:'Wiki: portal-bff page sync after merge', status:'succeeded', actor:'Tech-Writer', agent:'tech-writer', started:'2026-05-08 06:02', duration:'1m 11s', workspace:'customer-portal', project:'csp-v2', initiative:null, tokens:'8.4k', cost:'$0.21', repos:['portal-bff','wiki'], filesChanged:1, filesGenerated:0, polarisFindings:0 },
  { id:'OP-2026-05-07-031', title:'Fraud-scorer model uplift — generate test fixtures', status:'succeeded', actor:'Robin Lee', agent:'engineer', started:'2026-05-07 16:48', duration:'9m 02s', workspace:'fraud-claims', project:'fraud-uplift', initiative:'fraud-uplift-prog', tokens:'58k', cost:'$1.84', repos:['fraud-scorer'], filesChanged:0, filesGenerated:18, polarisFindings:3 },
  { id:'OP-2026-05-07-018', title:'Snowflake ingest — schema diff & migration plan', status:'succeeded', actor:'Chris Okafor', agent:'data-agent', started:'2026-05-07 14:12', duration:'12m 48s', workspace:'lending-data', project:'snowflake-ingest', initiative:null, tokens:'94k', cost:'$3.10', repos:['warehouse-models'], filesChanged:6, filesGenerated:4, polarisFindings:0 },
  { id:'OP-2026-05-07-006', title:'CSP v2 — accessibility sweep', status:'failed', actor:'Sarah Chen', agent:'engineer', started:'2026-05-07 11:33', duration:'22m · halted', workspace:'customer-portal', project:'csp-v2', initiative:null, tokens:'76k', cost:'$2.41', repos:['portal-bff','customer-web'], filesChanged:7, filesGenerated:1, polarisFindings:4 },
  { id:'OP-2026-05-06-019', title:'Lending Modernisation — initiative brief draft', status:'awaiting-review', actor:'Robin Lee', agent:'spec-agent', started:'2026-05-06 17:09', duration:'6m 33s', workspace:null, project:null, initiative:'lending-modernisation', tokens:'42k', cost:'$1.41', repos:[], filesChanged:0, filesGenerated:5, polarisFindings:1 },
  { id:'OP-2026-05-06-011', title:'GDPR DSR runbook validation', status:'succeeded', actor:'Nadia Iqbal', agent:'compliance-agent', started:'2026-05-06 10:25', duration:'3m 47s', workspace:'platform', project:null, initiative:null, tokens:'11k', cost:'$0.32', repos:['platform-runbooks'], filesChanged:0, filesGenerated:1, polarisFindings:0 },
];

const SNP_STATUS_TONE = {
  'running':         { c:'#60A5FA', dot:'#3B82F6', label:'Running' },
  'awaiting-review': { c:'#FCD34D', dot:'#F59E0B', label:'Awaiting review' },
  'succeeded':       { c:'#A7F3D0', dot:'#10B981', label:'Succeeded' },
  'failed':          { c:'#FCA5A5', dot:'#EF4444', label:'Failed' },
};

const ACTIVE_STATUS = ['running','awaiting-review'];

const WORKSPACES = ['customer-portal','fraud-claims','lending-data','platform','policy-underwriting'];
const PROJECTS_BY_WS = {
  'customer-portal': ['csp-v2','portal-uplift'],
  'fraud-claims':    ['fraud-uplift'],
  'lending-data':    ['snowflake-ingest'],
  'platform':        [],
  'policy-underwriting': [],
};
const SNAPPY_INITIATIVES = ['(none)','lending-modernisation','fraud-uplift-prog','customer-zero','platform-hardening-fy26'];

// ─────────────────────────────── ROOT ───────────────────────────────

const SnappyScreen = ({ navigate }) => {
  const [query, setQuery] = uS_sn(parseSnappyQuery());
  uE_sn(() => {
    const onHash = () => setQuery(parseSnappyQuery());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [filter, setFilter] = uS_sn('active'); // active | all
  const [search, setSearch] = uS_sn('');

  // Initialise selected operation: if ?op=... in URL, pick it; else 'new' composer
  const initialOp = query.op || 'new';
  const [selected, setSelected] = uS_sn(initialOp);

  uE_sn(() => {
    if (query.op && query.op !== selected) setSelected(query.op);
  }, [query.op]);

  const list = uM_sn(() => {
    return SNP_OPERATIONS.filter(o => {
      if (filter === 'active' && !ACTIVE_STATUS.includes(o.status)) return false;
      if (search && !(o.title.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search))) return false;
      return true;
    });
  }, [filter, search]);

  const op = SNP_OPERATIONS.find(o => o.id === selected) || null;

  return (
    <div className="page-enter" style={{ height:'calc(100vh - 44px)', display:'grid', gridTemplateColumns:'320px 1fr 360px' }}>
      <SnpOpsList
        list={list} filter={filter} setFilter={setFilter}
        search={search} setSearch={setSearch}
        selected={selected} onSelect={(id) => { setSelected(id); }}
        navigate={navigate}
      />
      {selected === 'new'
        ? <SnpComposer query={query} navigate={navigate}/>
        : <SnpOperationView op={op} navigate={navigate}/>}
      {selected === 'new'
        ? <SnpContextPane query={query} navigate={navigate}/>
        : <SnpOperationAside op={op} navigate={navigate}/>}
    </div>
  );
};

// ─────────────────────────────── LEFT: ops list ───────────────────────────────

const SnpOpsList = ({ list, filter, setFilter, search, setSearch, selected, onSelect, navigate }) => {
  return (
    <div style={{ borderRight:'1px solid var(--line)', display:'flex', flexDirection:'column', background:'var(--surface)', minHeight: 0 }}>
      <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10 }}>
          <Icon name="sparkle" size={14} style={{ color:'var(--blue-bright)' }}/>
          <h2 style={{ margin:0, fontSize: 14, fontWeight: 600 }}>Operations</h2>
          <div style={{ flex:1 }}/>
          <Btn size="sm" icon="plus" variant="primary" onClick={() => onSelect('new')}>New</Btn>
        </div>
        <div style={{ display:'flex', gap: 4, marginBottom: 8 }}>
          {[
            { id:'active', label:`Active · ${SNP_OPERATIONS.filter(o => ACTIVE_STATUS.includes(o.status)).length}` },
            { id:'all',    label:`All · ${SNP_OPERATIONS.length}` },
          ].map(t => (
            <button key={t.id} className={`tab ${filter === t.id ? 'active' : ''}`}
              style={{ fontSize: 11, padding:'4px 8px' }}
              onClick={() => setFilter(t.id)}>{t.label}</button>
          ))}
        </div>
        <input className="inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ops…" style={{ width:'100%', height: 26, fontSize: 11.5 }}/>
      </div>

      <div style={{ flex:1, overflow:'auto' }}>
        {list.length === 0 && (
          <div style={{ padding: 20, fontSize: 11.5, color:'var(--text-mute)', textAlign:'center' }}>No operations match.</div>
        )}
        {list.map(o => {
          const tone = SNP_STATUS_TONE[o.status];
          const active = selected === o.id;
          return (
            <div key={o.id}
              onClick={() => onSelect(o.id)}
              className="row-hover"
              style={{
                padding:'10px 14px', borderBottom:'1px solid var(--line-soft)', cursor:'pointer',
                background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                borderLeft: active ? '2px solid var(--blue-bright)' : '2px solid transparent',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius:'50%', background: tone.dot, boxShadow: o.status==='running' ? `0 0 0 3px ${tone.dot}33` : 'none' }}/>
                <span className="mono" style={{ fontSize: 10, color:'var(--text-mute)' }}>{o.id}</span>
                <div style={{ flex:1 }}/>
                {o.polarisFindings > 0 && <span style={{ fontSize: 9.5, padding:'1px 5px', borderRadius: 2, background:'rgba(167,139,250,0.18)', color:'#C4B5FD', fontWeight: 600 }}>★ {o.polarisFindings}</span>}
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.35, marginBottom: 4, color: active ? 'var(--text)' : 'var(--text-dim)' }}>{o.title}</div>
              <div style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 10.5, color:'var(--text-mute)' }}>
                <span style={{ color: tone.c }}>{tone.label}</span>
                <span>·</span>
                <span>{o.duration}</span>
                <span>·</span>
                <span>{o.actor}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────── CENTER: composer (new request) ───────────────────────────────

const SnpComposer = ({ query, navigate }) => {
  const [stage, setStage] = uS_sn(0);
  const [input, setInput] = uS_sn(query.project === 'fraud-uplift'
    ? 'Fraud-scorer model uplift: add a feature for cross-policy velocity, retrain, and validate against the v3.1 baseline. Maintain the 0.92 precision target.'
    : 'Northwind needs a new claims fast-track service for motor claims under £2,500 — auto-adjudicate, auto-disburse if no fraud signal, route exceptions to humans, full audit.');

  const submit = () => {
    setStage(1);
    setTimeout(() => setStage(2), 2400);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight: 0, background:'var(--bg)' }}>
      <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--line)', background:'var(--surface)' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Icon name="sparkle" size={15} style={{ color:'var(--blue-bright)' }}/>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>New operation</h2>
          <span className="chip blue">Snappy Request → Spec Proposal</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11.5, color:'var(--text-mute)' }}>
          The front door for new work. Describe what you want; the Spec Agent grounds it in your context (right) and drafts a brief, PRD, and tech spec for review.
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding: 18, display:'flex', flexDirection:'column', gap: 14 }}>
        {stage === 0 && (
          <div style={{ color: 'var(--text-mute)', fontSize: 12, textAlign:'center', marginTop: 8, padding: 12, border:'1px dashed var(--line)', borderRadius: 6 }}>
            Set your context on the right (workspace, project, initiative, business case), then describe what you'd like to build.
          </div>
        )}
        {stage >= 1 && <ChatBubble role="user">{input}</ChatBubble>}
        {stage >= 1 && <AgentMessages stage={stage} navigate={navigate}/>}
        {stage > 0 && <SpecPanels stage={stage} navigate={navigate}/>}
      </div>

      <div style={{ padding: 14, borderTop:'1px solid var(--line)', background:'var(--surface)' }}>
        <textarea
          disabled={stage > 0}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe what you want to build…"
          rows="3"
          style={{
            width:'100%', background:'var(--bg)', border:'1px solid var(--line)', borderRadius: 6,
            padding: 10, color:'var(--text)', fontSize: 12.5, fontFamily:'inherit', resize:'none', outline:'none',
          }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8 }}>
          <span style={{ fontSize: 10.5, color:'var(--text-mute)' }}>Context: {query.project ? `project ${query.project}` : (query.workspace ? `workspace ${query.workspace}` : 'unscoped — set on right')}</span>
          <Btn variant="primary" icon="sparkle" onClick={submit}>{stage === 0 ? 'Submit' : 'Submitted'}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────── RIGHT: context pane (new) ───────────────────────────────

const SnpContextPane = ({ query, navigate }) => {
  const [mode, setMode] = uS_sn(query.initiative ? 'initiative' : (query.project ? 'project' : 'workspace'));
  const [ws, setWs] = uS_sn(query.workspace || 'fraud-claims');
  const [proj, setProj] = uS_sn(query.project || '');
  const [init, setInit] = uS_sn(query.initiative || '(none)');

  const projects = PROJECTS_BY_WS[ws] || [];

  return (
    <div style={{ borderLeft:'1px solid var(--line)', background:'var(--surface)', overflow:'auto', padding: 16 }}>
      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Operation context</div>

      <div style={{ display:'flex', gap: 4, marginBottom: 12 }}>
        {[
          { id:'workspace',  label:'Workspace' },
          { id:'project',    label:'Project' },
          { id:'initiative', label:'New initiative' },
        ].map(m => (
          <button key={m.id} className={`tab ${mode===m.id?'active':''}`} style={{ fontSize: 11, padding:'4px 8px' }} onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
      </div>

      <FormRow label="Workspace">
        <select className="inp" value={ws} onChange={e => { setWs(e.target.value); setProj(''); }} style={{ width:'100%', height: 28, fontSize: 12 }}>
          {WORKSPACES.map(w => <option key={w}>{w}</option>)}
        </select>
      </FormRow>

      {mode === 'project' && (
        <FormRow label="Project">
          <select className="inp" value={proj} onChange={e => setProj(e.target.value)} style={{ width:'100%', height: 28, fontSize: 12 }}>
            <option value="">— pick project —</option>
            {projects.map(p => <option key={p}>{p}</option>)}
          </select>
        </FormRow>
      )}

      <FormRow label={mode === 'initiative' ? 'Initiative (creating new)' : 'Initiative (optional)'}>
        <select className="inp" value={init} onChange={e => setInit(e.target.value)} style={{ width:'100%', height: 28, fontSize: 12 }}>
          {SNAPPY_INITIATIVES.map(i => <option key={i}>{i}</option>)}
        </select>
        {mode === 'initiative' && <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 4 }}>A draft initiative will be created on submit.</div>}
      </FormRow>

      <div style={{ height: 1, background:'var(--line)', margin:'14px 0' }}/>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Identification</div>
      <FormRow label="Working title">
        <input className="inp" defaultValue={mode==='initiative' ? 'Motor fast-track claims' : 'Untitled operation'} style={{ width:'100%', height: 28, fontSize: 12 }}/>
      </FormRow>
      <FormRow label="Owner">
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Avatar name="Maya Patel" size={22}/>
          <span style={{ fontSize: 12 }}>Maya Patel</span>
          <a style={{ marginLeft:'auto', fontSize: 11, color:'var(--blue-bright)', cursor:'pointer' }}>change</a>
        </div>
      </FormRow>
      <FormRow label="Stakeholders">
        <div style={{ display:'flex', gap: -4 }}>
          {['Robin Lee','Nadia Iqbal','Tom Reilly'].map((n,i) => (
            <div key={n} style={{ marginLeft: i?-6:0, border:'2px solid var(--surface)', borderRadius:'50%' }}><Avatar name={n} size={22}/></div>
          ))}
          <a style={{ marginLeft: 8, fontSize: 11, color:'var(--blue-bright)', cursor:'pointer', alignSelf:'center' }}>+ add</a>
        </div>
      </FormRow>

      <div style={{ height: 1, background:'var(--line)', margin:'14px 0' }}/>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Business case</div>
      <FormRow label="Problem statement">
        <textarea className="inp" rows={3} defaultValue="Manual triage of small motor claims costs ~£420k/yr and adds 4–7 days latency for customers."
          style={{ width:'100%', fontSize: 11.5, fontFamily:'inherit', padding: 8, resize:'vertical' }}/>
      </FormRow>
      <FormRow label="Hypothesis">
        <textarea className="inp" rows={2} defaultValue="Auto-adjudicating sub-£2.5k motor claims with no fraud signal will cut cycle time by 80% and save £300k/yr."
          style={{ width:'100%', fontSize: 11.5, fontFamily:'inherit', padding: 8, resize:'vertical' }}/>
      </FormRow>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginTop: 6 }}>
        <FormRow label="Value (annual)">
          <input className="inp" defaultValue="£300k" style={{ width:'100%', height: 28, fontSize: 12 }}/>
        </FormRow>
        <FormRow label="Investment">
          <input className="inp" defaultValue="£180k · 1Q" style={{ width:'100%', height: 28, fontSize: 12 }}/>
        </FormRow>
      </div>
      <FormRow label="KPIs">
        <div style={{ display:'flex', gap: 4, flexWrap:'wrap' }}>
          {['cycle time','£/claim','customer NPS','adjuster hours saved'].map(k => <span key={k} className="chip" style={{ fontSize: 10.5 }}>{k}</span>)}
          <a style={{ fontSize: 11, color:'var(--blue-bright)', cursor:'pointer', alignSelf:'center' }}>+ add</a>
        </div>
      </FormRow>

      <div style={{ height: 1, background:'var(--line)', margin:'14px 0' }}/>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Constitution attached</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
        {[
          { d:'Customer claims policy v3', cat:'Policy' },
          { d:'GDPR interpretation guide',  cat:'Compliance' },
          { d:'Auto-disbursement ADR-0042', cat:'Decision' },
        ].map((d,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 8px', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, fontSize: 11.5 }}>
            <Icon name="doc" size={11} style={{ color:'var(--text-mute)' }}/>
            <span style={{ flex:1, color:'var(--text-dim)' }}>{d.d}</span>
            <span className="chip" style={{ fontSize: 10 }}>{d.cat}</span>
          </div>
        ))}
        <a onClick={() => navigate('/organisation/company/documents')} style={{ fontSize: 11, color:'var(--blue-bright)', cursor:'pointer', marginTop: 4 }}>+ attach from constitution</a>
      </div>

      <div style={{ height: 1, background:'var(--line)', margin:'14px 0' }}/>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Run mode</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 6, fontSize: 12 }}>
        {[
          { id:'spec',   label:'Draft spec only',          desc:'Spec Agent produces brief/PRD/tech spec.' },
          { id:'build',  label:'Spec → review → build',     desc:'Auto-progress through HITL gates.' },
          { id:'sandbox',label:'Spike (sandbox repo)',      desc:'Throwaway exploration. No prod merge.' },
        ].map((m,i) => (
          <label key={m.id} style={{ display:'flex', alignItems:'flex-start', gap: 8, padding: 8, background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, cursor:'pointer' }}>
            <input type="radio" name="runmode" defaultChecked={i===0} style={{ marginTop: 2 }}/>
            <div>
              <div style={{ color:'var(--text)', fontSize: 12 }}>{m.label}</div>
              <div style={{ color:'var(--text-mute)', fontSize: 10.5, marginTop: 2 }}>{m.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

const FormRow = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom: 4 }}>{label}</div>
    {children}
  </div>
);

// ─────────────────────────────── CENTER: existing operation viewer ───────────────────────────────

const SnpOperationView = ({ op, navigate }) => {
  if (!op) return <div style={{ padding: 40, color:'var(--text-mute)' }}>Pick an operation.</div>;
  const tone = SNP_STATUS_TONE[op.status];
  const [tab, setTab] = uS_sn('console');

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight: 0, background:'var(--bg)' }}>
      <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--line)', background:'var(--surface)' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{op.id}</span>
          <span style={{ width: 6, height: 6, borderRadius:'50%', background: tone.dot }}/>
          <span style={{ fontSize: 11, color: tone.c }}>{tone.label}</span>
          <div style={{ flex:1 }}/>
          {op.status === 'running' && <Btn size="sm" icon="pause">Pause</Btn>}
          {op.status === 'awaiting-review' && <Btn size="sm" variant="primary" icon="check">Approve</Btn>}
          <Btn size="sm" icon="terminal">Open in IDE</Btn>
          <Btn size="sm" variant="ghost" icon="x" onClick={() => navigate('/snappy')}>Close</Btn>
        </div>
        <h2 style={{ margin:'2px 0 6px', fontSize: 16, fontWeight: 600 }}>{op.title}</h2>
        <div style={{ display:'flex', alignItems:'center', gap: 10, fontSize: 11, color:'var(--text-mute)' }}>
          <Avatar name={op.actor} size={18}/>
          <span style={{ color:'var(--text-dim)' }}>{op.actor}</span>
          <span>·</span>
          <span>agent {op.agent}</span>
          <span>·</span>
          <span>started {op.started}</span>
          <span>·</span>
          <span>{op.duration}</span>
          <span>·</span>
          <span className="mono">{op.tokens} tok</span>
          <span>·</span>
          <span className="mono">{op.cost}</span>
        </div>
        <div style={{ display:'flex', gap: 4, marginTop: 12 }}>
          {[
            { id:'console',  label:'Console',  icon:'terminal' },
            { id:'files',    label:'Files',    icon:'doc' },
            { id:'repos',    label:'Repos',    icon:'branch' },
            { id:'timeline', label:'Timeline', icon:'layers' },
            { id:'audit',    label:'Audit',    icon:'shield-check' },
          ].map(t => (
            <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={11}/> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflow:'auto', padding: 18 }}>
        {tab === 'console'  && <ConsoleTab op={op}/>}
        {tab === 'files'    && <FilesTab op={op}/>}
        {tab === 'repos'    && <ReposTab op={op}/>}
        {tab === 'timeline' && <TimelineTab op={op}/>}
        {tab === 'audit'    && <AuditTab op={op} navigate={navigate}/>}
      </div>
    </div>
  );
};

const ConsoleLines = (op) => {
  const lines = [
    { t:'00:00.012', sev:'INFO',  text:`[orchestrator] starting operation ${op.id} for ${op.actor}` },
    { t:'00:00.218', sev:'INFO',  text:`[context] loading constitution: 3 documents, 12 glossary terms, 4 ontology classes` },
    { t:'00:00.701', sev:'INFO',  text:`[context] resolved workspace=${op.workspace || '—'} project=${op.project || '—'} initiative=${op.initiative || '—'}` },
    { t:'00:01.124', sev:'INFO',  text:`[${op.agent}] ${op.title} — drafting plan` },
    { t:'00:01.890', sev:'INFO',  text:`[tool] org_graph_search "claims-svc" → 3 matches` },
    { t:'00:02.412', sev:'INFO',  text:`[tool] read_file specs/0083-fast-track.md (412 lines)` },
    { t:'00:03.001', sev:'WARN',  text:`[critic] section "out of scope" appears empty — flagging for HITL` },
    { t:'00:03.221', sev:'INFO',  text:`[tool] grep "rate_limit" portal-bff/* → 4 matches` },
    { t:'00:04.018', sev:'INFO',  text:`[${op.agent}] generated 3 artefacts (brief, prd, techspec)` },
    { t:'00:04.220', sev:'INFO',  text:`[polaris] observation logged: "scope ambiguity flagged — candidate prompt edit"` },
    { t:'00:04.501', sev:'INFO',  text:`[orchestrator] handing off to HITL — awaiting approval`,
      stop: op.status === 'awaiting-review' },
    { t:'00:14.104', sev:'INFO',  text:`[engineer] applying patch portal-bff/auth/middleware.ts (+82 -41)` },
    { t:'00:14.412', sev:'INFO',  text:`[tool] run_tests portal-bff (143 tests)` },
    { t:'00:16.881', sev:op.status==='failed'?'ERROR':'INFO', text: op.status==='failed' ? `[tool] run_tests FAILED — 3 of 143 tests failing` : `[tool] run_tests PASSED — 143/143` },
  ];
  if (op.status === 'awaiting-review') return lines.slice(0, 11);
  if (op.status === 'running')         return lines.slice(0, 12);
  if (op.status === 'failed')          return lines;
  return lines.filter(l => !l.stop);
};

const ConsoleTab = ({ op }) => {
  const lines = ConsoleLines(op);
  return (
    <div className="card" style={{ padding: 0, overflow:'hidden', background:'#08101A' }}>
      <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap: 8, fontSize: 11 }}>
        <Icon name="terminal" size={11} style={{ color:'var(--text-mute)' }}/>
        <span style={{ color:'var(--text-mute)' }}>console · streaming</span>
        <div style={{ flex:1 }}/>
        <Btn size="sm" variant="ghost" icon="copy">Copy</Btn>
        <Btn size="sm" variant="ghost" icon="download">Export</Btn>
      </div>
      <div style={{ padding:'10px 14px', fontFamily:'var(--mono)', fontSize: 11.5, lineHeight: 1.7 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 50px 1fr', gap: 10 }}>
            <span style={{ color:'var(--text-mute)' }}>{l.t}</span>
            <span style={{ color: l.sev==='ERROR'?'#FCA5A5':l.sev==='WARN'?'#FCD34D':'var(--text-mute)', fontWeight: 600 }}>{l.sev}</span>
            <span style={{ color: l.sev==='ERROR'?'#FCA5A5':'var(--text-dim)' }}>{l.text}</span>
          </div>
        ))}
        {op.status === 'running' && <div style={{ color:'var(--blue-bright)', marginTop: 4 }}>▍</div>}
      </div>
    </div>
  );
};

const FilesTab = ({ op }) => {
  const files = [
    op.filesGenerated > 0 && { kind:'generated', path:'specs/0091-fast-track.md',     diff:'+412 lines',  who:op.agent },
    op.filesGenerated > 1 && { kind:'generated', path:'specs/0091-fast-track-prd.md', diff:'+318 lines',  who:op.agent },
    op.filesGenerated > 2 && { kind:'generated', path:'specs/0091-fast-track-tech.md',diff:'+204 lines',  who:op.agent },
    op.filesChanged   > 0 && { kind:'modified',  path:'portal-bff/auth/middleware.ts',diff:'+82 −41',     who:op.agent },
    op.filesChanged   > 1 && { kind:'modified',  path:'portal-bff/tests/auth.spec.ts',diff:'+34 −12',     who:op.agent },
    op.filesChanged   > 6 && { kind:'modified',  path:'customer-web/components/AuthGuard.tsx', diff:'+18 −4', who:op.agent },
  ].filter(Boolean);
  return (
    <div className="card" style={{ padding: 0, overflow:'hidden' }}>
      <div style={{ background:'var(--surface)', padding:'10px 14px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px', gap: 10, fontSize: 10, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight: 600 }}>
        <span>Kind</span><span>Path</span><span>Diff</span><span>By</span><span>Action</span>
      </div>
      {files.length === 0
        ? <div style={{ padding: 18, fontSize: 11.5, color:'var(--text-mute)', textAlign:'center' }}>No file output for this operation.</div>
        : files.map((f,i) => (
            <div key={i} style={{ padding:'8px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'90px 1fr 120px 100px 80px', gap: 10, fontSize: 11.5, alignItems:'center' }}>
              <span className="chip" style={{ background: f.kind==='generated' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', color: f.kind==='generated' ? '#A7F3D0' : '#BFDBFE' }}>{f.kind}</span>
              <span className="mono" style={{ color:'var(--text)' }}>{f.path}</span>
              <span className="mono" style={{ color:'var(--text-dim)' }}>{f.diff}</span>
              <span style={{ color:'var(--blue-bright)' }}>{f.who}</span>
              <Btn size="sm" variant="ghost" icon="search">Open</Btn>
            </div>
          ))}
    </div>
  );
};

const ReposTab = ({ op }) => (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
    {op.repos.length === 0 && <div style={{ padding: 18, fontSize: 11.5, color:'var(--text-mute)' }}>No repository touched.</div>}
    {op.repos.map(r => (
      <div key={r} className="card" style={{ padding: 14 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
          <Icon name="branch" size={12} style={{ color:'var(--blue-bright)' }}/>
          <span className="mono" style={{ fontSize: 12.5 }}>{r}</span>
          <div style={{ flex:1 }}/>
          <span className="chip" style={{ fontSize: 10 }}>main</span>
        </div>
        <div style={{ fontSize: 11, color:'var(--text-mute)', marginBottom: 8 }}>operation/{op.id.toLowerCase()}</div>
        <div style={{ fontFamily:'var(--mono)', fontSize: 10.5, color:'var(--text-dim)', background:'var(--raised)', padding: 8, borderRadius: 4, lineHeight: 1.7 }}>
          <div>↳ branch · 3 commits</div>
          <div>↳ +136 −53 across 4 files</div>
          <div>↳ PR #4218 — open · 2 approvals</div>
        </div>
        <div style={{ display:'flex', gap: 6, marginTop: 10 }}>
          <Btn size="sm" icon="branch">Open PR</Btn>
          <Btn size="sm" variant="ghost" icon="terminal">View diff</Btn>
        </div>
      </div>
    ))}
  </div>
);

const TimelineTab = ({ op }) => {
  const phases = [
    { l:'Plan',        s:'done',    t:'00:00 → 00:01', who:op.agent },
    { l:'Context',     s:'done',    t:'00:01 → 00:03', who:op.agent },
    { l:'Draft',       s:'done',    t:'00:03 → 00:04', who:op.agent },
    { l:'HITL review', s: op.status==='awaiting-review' ? 'active' : 'done', t:'00:04 → ?', who:op.actor },
    { l:'Build',       s: op.status==='running' ? 'active' : (op.status==='succeeded'?'done':'pending'), t:'pending', who:op.agent },
    { l:'Verify',      s: op.status==='succeeded'?'done':'pending', t:'pending', who:'critic' },
    { l:'Merge',       s: op.status==='succeeded'?'done':'pending', t:'pending', who:'reviewer' },
  ];
  return (
    <div className="card" style={{ padding: 16 }}>
      {phases.map((p, i) => {
        const dot = p.s==='done' ? '#10B981' : p.s==='active' ? '#60A5FA' : 'var(--line)';
        return (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'24px 1fr 130px 110px', gap: 10, alignItems:'center', padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none' }}>
            <div style={{ width: 16, height: 16, borderRadius:'50%', background: dot, boxShadow: p.s==='active' ? `0 0 0 4px ${dot}33` : 'none', justifySelf:'center' }}/>
            <span style={{ fontSize: 12.5, color: p.s==='pending' ? 'var(--text-mute)' : 'var(--text)' }}>{p.l}</span>
            <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.t}</span>
            <span style={{ fontSize: 11, color:'var(--blue-bright)' }}>{p.who}</span>
          </div>
        );
      })}
    </div>
  );
};

const AuditTab = ({ op, navigate }) => (
  <div className="card" style={{ padding: 16 }}>
    <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 10 }}>Every tool call from this operation is recorded in the chain. Verify integrity or scrub the full session.</div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
      {[
        { l:'Entries',  v: op.status === 'failed' ? '47' : '32' },
        { l:'Reads',    v:'18' },
        { l:'Writes',   v: String(op.filesGenerated + op.filesChanged) },
        { l:'Bashes',   v:'9' },
      ].map(s => (
        <div key={s.l} style={{ padding: 10, background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4 }}>
          <div className="h-eyebrow">{s.l}</div>
          <div className="mono" style={{ fontSize: 16, marginTop: 2 }}>{s.v}</div>
        </div>
      ))}
    </div>
    <Btn icon="shield-check" onClick={() => navigate('/audit')}>Open in Audit</Btn>
  </div>
);

// ─────────────────────────────── RIGHT: operation aside ───────────────────────────────

const SnpOperationAside = ({ op, navigate }) => {
  if (!op) return <div/>;
  const polarisFor = SNP_POLARIS_FINDINGS.filter(p => p.opId === op.id);
  return (
    <div style={{ borderLeft:'1px solid var(--line)', background:'var(--surface)', overflow:'auto', padding: 16 }}>
      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Context</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 6, marginBottom: 14 }}>
        <AsideRow icon="layers" label="Workspace" value={op.workspace || '—'} click={op.workspace ? () => navigate(`/workspace/${op.workspace}`) : null}/>
        <AsideRow icon="cube"   label="Project"   value={op.project || '—'}   click={op.project ? () => navigate(`/project/${op.project}/dashboard`) : null}/>
        <AsideRow icon="graph"  label="Initiative" value={op.initiative || '—'} click={op.initiative ? () => navigate(`/organisation/transformations/${op.initiative}`) : null}/>
      </div>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Generated artefacts</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 4, marginBottom: 14 }}>
        {op.filesGenerated > 0 ? (
          <>
            <ArtefactRow icon="doc" label="Brief" detail="412 lines · spec/0091-fast-track.md"/>
            {op.filesGenerated > 1 && <ArtefactRow icon="doc" label="PRD" detail="318 lines"/>}
            {op.filesGenerated > 2 && <ArtefactRow icon="layers" label="Tech spec" detail="204 lines · 1 diagram"/>}
          </>
        ) : <div style={{ fontSize: 11.5, color:'var(--text-mute)' }}>No artefacts produced.</div>}
      </div>

      <div className="h-eyebrow" style={{ marginBottom: 8 }}>Repos</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 4, marginBottom: 14 }}>
        {op.repos.length === 0 && <div style={{ fontSize: 11.5, color:'var(--text-mute)' }}>—</div>}
        {op.repos.map(r => (
          <a key={r} className="row-hover" style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 8px', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, fontSize: 11.5, cursor:'pointer', textDecoration:'none', color:'inherit' }}>
            <Icon name="branch" size={11} style={{ color:'var(--blue-bright)' }}/>
            <span className="mono" style={{ flex:1 }}>{r}</span>
            <Icon name="arrow-right" size={10} style={{ color:'var(--text-mute)' }}/>
          </a>
        ))}
      </div>

      <div style={{ height: 1, background:'var(--line)', margin:'14px 0' }}/>

      {/* Polaris findings */}
      <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius:'50%', background:'#A78BFA' }}/>
        <div className="h-eyebrow">Polaris findings</div>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize: 10, padding:'1px 5px', borderRadius: 2, background:'rgba(167,139,250,0.18)', color:'#C4B5FD', fontWeight: 600 }}>{polarisFor.length}</span>
      </div>
      <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginBottom: 8 }}>Observations Polaris drew from this operation. Each can become a meta-improvement proposal.</div>
      {polarisFor.length === 0 && (
        <div style={{ padding: 10, border:'1px dashed var(--line)', borderRadius: 4, fontSize: 11, color:'var(--text-mute)', textAlign:'center' }}>No findings — clean run.</div>
      )}
      {polarisFor.map(p => (
        <div key={p.id} className="card" style={{ padding: 10, marginBottom: 8, borderLeft: '2px solid #A78BFA' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 10, color:'var(--text-mute)' }}>{p.id}</span>
            <span style={{ fontSize: 9.5, padding:'1px 5px', borderRadius: 2, background:'rgba(167,139,250,0.18)', color:'#C4B5FD', fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{p.kind}</span>
            <div style={{ flex:1 }}/>
            <span style={{ fontSize: 10, color: p.severity==='high'?'#FCA5A5':p.severity==='med'?'#FCD34D':'var(--text-mute)' }}>· {p.severity}</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 6 }}>{p.title}</div>
          <div style={{ fontSize: 11, color:'var(--text-dim)', lineHeight: 1.5, marginBottom: 8 }}>{p.evidence}</div>
          <div style={{ display:'flex', gap: 6 }}>
            <Btn size="sm" variant="primary" icon="sparkle" onClick={() => navigate('/polaris')}>Promote</Btn>
            <Btn size="sm" variant="ghost">Dismiss</Btn>
          </div>
        </div>
      ))}
    </div>
  );
};

const AsideRow = ({ icon, label, value, click }) => (
  <div onClick={click || undefined}
    style={{ display:'flex', alignItems:'center', gap: 8, padding:'6px 8px', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, cursor: click ? 'pointer' : 'default' }}>
    <Icon name={icon} size={11} style={{ color:'var(--text-mute)' }}/>
    <span style={{ fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em', minWidth: 64 }}>{label}</span>
    <span style={{ fontSize: 12, color: click ? 'var(--blue-bright)' : 'var(--text-dim)' }} className="mono">{value}</span>
    {click && <Icon name="arrow-right" size={10} style={{ color:'var(--text-mute)', marginLeft:'auto' }}/>}
  </div>
);

const ArtefactRow = ({ icon, label, detail }) => (
  <div style={{ display:'flex', alignItems:'center', gap: 8, padding:'5px 8px', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, fontSize: 11.5 }}>
    <Icon name={icon} size={11} style={{ color:'var(--text-mute)' }}/>
    <div style={{ display:'flex', flexDirection:'column' }}>
      <span style={{ color:'var(--text)' }}>{label}</span>
      <span style={{ color:'var(--text-mute)', fontSize: 10 }}>{detail}</span>
    </div>
    <a style={{ marginLeft:'auto', fontSize: 10.5, color:'var(--blue-bright)', cursor:'pointer' }}>open</a>
  </div>
);

// Polaris findings, scoped to operations
const SNP_POLARIS_FINDINGS = [
  { opId:'OP-2026-05-08-014', id:'PL-2026-05-08-007', kind:'PROMPT',  severity:'med',  title:'Spec Agent skipped scope-bounding question',
    evidence:'Critic flagged "scope: out" empty; user later added 2 paragraphs of constraints. Suggests pre-prompt should elicit OOS upfront.' },
  { opId:'OP-2026-05-08-014', id:'PL-2026-05-08-008', kind:'CONTEXT', severity:'low',  title:'ADR-0042 (auto-disbursement) not in context window',
    evidence:'Spec proposes auto-disbursement; relevant prior decision exists but was not retrieved. Add semantic linker over Decisions.' },
  { opId:'OP-2026-05-08-009', id:'PL-2026-05-08-002', kind:'TOOL',    severity:'med',  title:'run_tests timed out → retry succeeded but cost 2× tokens',
    evidence:'Pattern seen in 4 of last 14 ops. Investigate test-runner warm-up or move to incremental mode.' },
  { opId:'OP-2026-05-07-031', id:'PL-2026-05-07-022', kind:'WORKFLOW',severity:'high', title:'Fixture generation ran without baseline-precision check',
    evidence:'Fixtures could shift the eval distribution. Insert pre-step: snapshot validation precision before generating.' },
  { opId:'OP-2026-05-07-031', id:'PL-2026-05-07-023', kind:'PROMPT',  severity:'low',  title:'Tech-Writer wiki page didn\'t cite source code',
    evidence:'Findings consistent with existing proposal PL-2026-05-01-022. Reinforces priority.' },
  { opId:'OP-2026-05-07-031', id:'PL-2026-05-07-024', kind:'MODEL',   severity:'low',  title:'Sonnet was used for boilerplate fixtures — Haiku parity likely',
    evidence:'Cost $1.40 of $1.84 went to deterministic fixture rows.' },
  { opId:'OP-2026-05-07-006', id:'PL-2026-05-07-001', kind:'WORKFLOW',severity:'high', title:'Accessibility sweep halted on first blocker — should batch + report',
    evidence:'Engineer halted at first WCAG fail; better to enumerate all 23 issues and propose fixes in one pass.' },
  { opId:'OP-2026-05-07-006', id:'PL-2026-05-07-002', kind:'TOOL',    severity:'med',  title:'Missing tool: a11y_scan(html)',
    evidence:'Engineer hand-rolled axe runs. Adding a first-class tool would shorten this op by 7m.' },
  { opId:'OP-2026-05-07-006', id:'PL-2026-05-07-003', kind:'CONTEXT', severity:'med',  title:'Component library ADR not surfaced',
    evidence:'Three a11y fixes contradicted ADR-0027 (interactive contrast). Surface ADRs in build context.' },
  { opId:'OP-2026-05-07-006', id:'PL-2026-05-07-004', kind:'PROMPT',  severity:'low',  title:'Reviewer override pattern — auto-merge candidate',
    evidence:'In 6 of 9 a11y PRs, reviewer overrode 1 critic finding. Candidate for an exception rule.' },
  { opId:'OP-2026-05-06-019', id:'PL-2026-05-06-014', kind:'CONTEXT', severity:'med',  title:'Initiative brief lacked finance system context',
    evidence:'Spec Agent did not pull FinOps figures into the brief; Brian had to add them manually. Wire FinOps lookup.' },
];

// ——— composer agent stream / spec panels (carried over) ———

const ChatBubble = ({ role, children }) => (
  <div style={{
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '90%',
    padding: '10px 12px',
    borderRadius: 8,
    background: role === 'user' ? 'rgba(59,130,246,0.12)' : 'var(--raised)',
    border: '1px solid ' + (role === 'user' ? 'rgba(59,130,246,0.3)' : 'var(--line)'),
    fontSize: 12.5, lineHeight: 1.5,
  }}>{children}</div>
);

const AgentMessages = ({ stage, navigate }) => {
  const items = [
    { kind:'agent', text:'Reading your request…' },
    { kind:'agent', text:'Domains touched: Claims (primary), Customer (secondary). Lending discarded — out of scope.' },
    { kind:'q', q:'Should claims under £2,500 with prior fraud signals still skip human review?', a:'No — any fraud signal routes to human.' },
    { kind:'q', q:'Disbursement target: existing payment-svc or new payout-svc?', a:'Use existing payment-svc.' },
    { kind:'q', q:'SLA target for auto-adjudication?', a:'95% within 4 hours, 100% within 24h.' },
    { kind:'agent', text:'Generating proposal…', streaming: true },
    { kind:'agent', text:'✓ Brief generated' },
    { kind:'agent', text:'✓ PRD generated' },
    { kind:'agent', text:'✓ Tech spec generated' },
  ];
  const visible = stage === 2 ? items.length : Math.min(2, items.length);
  return <>
    {items.slice(0, visible).map((m, i) => {
      if (m.kind === 'agent') return (
        <ChatBubble key={i} role="agent">
          <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <Icon name="sparkle" size={11} style={{ color:'var(--blue-bright)' }}/>
            <span style={{ fontSize: 10, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Spec agent</span>
          </div>
          <div style={{ marginTop: 4 }}>{m.text}{m.streaming && <span className="blink mono"> ▍</span>}</div>
        </ChatBubble>
      );
      return (
        <div key={i} style={{ display:'flex', flexDirection:'column', gap: 6 }}>
          <ChatBubble role="agent">
            <div style={{ fontSize: 10, color:'var(--text-mute)' }}>CLARIFYING QUESTION</div>
            <div style={{ marginTop: 2 }}>{m.q}</div>
          </ChatBubble>
          <ChatBubble role="user">{m.a}</ChatBubble>
        </div>
      );
    })}
    {stage === 2 && (
      <div style={{ display:'flex', flexDirection:'column', gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 12, color:'var(--text-dim)', padding:'0 4px' }}>Ready for HITL review.</div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="primary" icon="check" onClick={() => navigate('/change')}>Approve & file as project</Btn>
          <Btn>Request changes</Btn>
        </div>
      </div>
    )}
  </>;
};

const SpecPanels = ({ stage }) => {
  if (stage < 2) return null;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12, marginTop: 6 }}>
      <Panel label="Domains touched" icon="cube">
        <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
          <span className="chip blue">Claims · primary</span>
          <span className="chip">Customer · secondary</span>
          <span className="chip" style={{ opacity:0.4, textDecoration:'line-through' }}>Lending</span>
        </div>
      </Panel>
      <Panel label="Services impacted" icon="cube">
        <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
          {[
            { n:'intake-svc', t:'modify' },
            { n:'fraud-scorer', t:'consume' },
            { n:'adjud-engine', t:'NEW', highlight: true },
            { n:'payment-svc', t:'consume' },
          ].map(s => (
            <div key={s.n} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'4px 8px', borderRadius: 4,
              background: s.highlight ? 'rgba(59,130,246,0.08)' : 'var(--raised)',
              border:'1px solid ' + (s.highlight ? 'rgba(59,130,246,0.4)' : 'var(--line)'),
            }}>
              <span className="mono" style={{ fontSize: 11.5 }}>{s.n}</span>
              <span className="chip">{s.t}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel label="Brief" icon="doc">
        <div style={{ fontSize: 12, lineHeight: 1.55, color:'var(--text-dim)' }}>
          A new Motor Fast-Track Claims Service will adjudicate motor claims under £2,500 in minutes. Claims with no fraud signal flow through fraud-scorer, adjud-engine, and payment-svc with full audit. Exceptions route to human review.
        </div>
      </Panel>
      <Panel label="Risks" icon="alert">
        {[
          { sev:'high', t:'Auto-disbursement increases regulatory risk' },
          { sev:'med',  t:'payment-svc rate-limits at 80 req/s' },
        ].map((r,i) => (
          <div key={i} style={{ padding: 6, borderLeft:`3px solid ${r.sev==='high'?'var(--red)':r.sev==='med'?'var(--amber)':'var(--green)'}`, background:'var(--raised)', borderRadius:'0 4px 4px 0', marginTop: i?6:0, fontSize: 11.5 }}>
            {r.t}
          </div>
        ))}
      </Panel>
    </div>
  );
};

const Panel = ({ label, icon, children }) => (
  <div className="card" style={{ padding: 12 }}>
    <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
      <Icon name={icon} size={11} style={{ color:'var(--text-mute)' }}/>
      <div className="h-eyebrow">{label}</div>
    </div>
    {children}
  </div>
);

window.SnappyScreen = SnappyScreen;

/* global React, Icon, Btn, Avatar */
const { useState: uS_co } = React;

// ─────────────────────────────────────────────────────────────────────────
// CONSTITUTION — sketch-quality stubs.
// Sub-tabs: Hub · Documents · Glossary · Ontology · C4 · Business Processes · Data Governance · Domains
// ─────────────────────────────────────────────────────────────────────────

const COMPANY_TABS = [
  { id:'hub',           label:'Overview' },
  { id:'documents',     label:'Documents' },
  { id:'glossary',      label:'Glossary' },
  { id:'ontology',      label:'Ontology' },
  { id:'c4',           label:'C4 explorer' },
  { id:'processes',     label:'Business processes' },
  { id:'governance',    label:'Data governance' },
  { id:'domains',       label:'Domains' },
];

const Company = ({ subRoute = [], navigate }) => {
  const tab = subRoute[0] || 'hub';
  return (
    <div className="page-enter">
      {/* secondary tabs row inside Company */}
      <div style={{ display:'flex', gap: 0, padding:'10px 24px 0', borderBottom:'1px solid var(--line-soft)', overflowX:'auto', background:'var(--bg)' }}>
        {COMPANY_TABS.map(t => (
          <div key={t.id}
            onClick={() => navigate(`/organisation/company/${t.id}`)}
            style={{
              padding:'10px 14px', fontSize: 12.5, cursor:'pointer', whiteSpace:'nowrap',
              color: tab===t.id ? 'var(--text)' : 'var(--text-mute)',
              borderBottom: tab===t.id ? '2px solid var(--blue-bright)' : '2px solid transparent',
              fontWeight: tab===t.id ? 500 : 400,
            }}>{t.label}</div>
        ))}
      </div>

      <div style={{ padding:'20px 24px', maxWidth: 1480, margin:'0 auto' }}>
        <CoHeader/>
        {tab === 'hub'           && <Hub navigate={navigate}/>}
        {tab === 'documents'     && <Documents/>}
        {tab === 'glossary'      && <Glossary/>}
        {tab === 'ontology'      && <Ontology/>}
        {tab === 'c4'            && window.C4Explorer && <window.C4Explorer subRoute={subRoute.slice(1)} navigate={navigate}/>}
        {tab === 'processes'     && <BusinessProcesses/>}
        {tab === 'governance'    && <DataGovernance/>}
        {tab === 'domains'       && <Domains navigate={navigate}/>}
      </div>
    </div>
  );
};

const CoHeader = () => (
  <div style={{ display:'flex', alignItems:'flex-end', gap: 16, marginBottom: 18 }}>
    <div style={{ width: 56, height: 56, borderRadius: 6, background:'linear-gradient(135deg,#5B8DEF,#A78BFA)', display:'grid', placeItems:'center', color:'#fff', fontSize: 22, fontWeight: 700 }}>N</div>
    <div style={{ flex:1 }}>
      <div className="h-eyebrow">Constitution</div>
      <h1 style={{ margin:'4px 0 4px', fontSize: 24, fontWeight: 600, letterSpacing:'-0.01em' }}>Northwind Mutual</h1>
      <div style={{ fontSize: 12.5, color:'var(--text-dim)' }}>Top of the cascade. Documents, terms, ontology, processes and governance defined here flow down into every domain, workspace, and project.</div>
    </div>
    <span className="chip" style={{ fontSize: 11 }}>5 domains</span>
    <span className="chip" style={{ fontSize: 11 }}>6 workspaces</span>
    <span className="chip" style={{ fontSize: 11 }}>12 services</span>
  </div>
);

const SketchBadge = () => (
  <span style={{ fontSize: 9.5, fontWeight: 600, padding:'1px 5px', borderRadius: 2, background:'rgba(167,139,250,0.18)', color:'#C4B5FD', textTransform:'uppercase', letterSpacing:'0.04em' }}>Sketch</span>
);

// ─────────── HUB ───────────
const Hub = ({ navigate }) => (
  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14 }}>
    {[
      { id:'documents',     icon:'doc',          title:'Documents',           sub:'Compliance, legal, security, brand, strategy', stat:'42 documents · 188 spec citations' },
      { id:'glossary',      icon:'list',         title:'Glossary',            sub:'Canonical business terms — single source of truth', stat:'214 terms · 17 disputed' },
      { id:'ontology',      icon:'graph',        title:'Ontology',            sub:'How business entities relate (RDF/OWL)',         stat:'38 classes · 96 relations' },
      { id:'c4',           icon:'branch',       title:'C4 explorer',         sub:'Context → Container → Component, with cascade overlays and flow lighting', stat:'3 levels · 12 containers · 7 multi-owned' },
      { id:'processes',     icon:'layers',       title:'Business processes',  sub:'BPMN swimlanes for human + machine flows',     stat:'19 processes · 6 cross-domain' },
      { id:'governance',    icon:'shield-check', title:'Data governance',     sub:'Lineage with classification tags',              stat:'12 datasets · 4 violations' },
    ].map(c => (
      <div key={c.id} className="card row-hover" onClick={() => navigate(`/organisation/company/${c.id}`)}
        style={{ padding: 16, cursor:'pointer', display:'flex', flexDirection:'column', gap: 8 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <Icon name={c.icon} size={14} style={{ color:'var(--blue-bright)' }}/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</span>
          <div style={{ flex:1 }}/>
          <SketchBadge/>
        </div>
        <div style={{ fontSize: 12, color:'var(--text-dim)', lineHeight: 1.5 }}>{c.sub}</div>
        <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 'auto' }}>{c.stat}</div>
      </div>
    ))}
    <div className="card" style={{ padding: 16, gridColumn:'span 3', background:'var(--blue-soft)', border:'1px solid rgba(91,141,239,0.3)' }}>
      <div style={{ fontSize: 12.5, color:'var(--text)' }}>
        <strong>Why Company sits at the top of the cascade.</strong> When the Spec Agent drafts a spec, it pulls relevant company documents (e.g. "GDPR interpretation", "EU residency baseline"), glossary terms touched by the spec, ontology classes the spec mentions, and governance rules over the data classes involved. Tightening these here propagates everywhere — and the agent is required to cite at least one principle per spec section.
      </div>
    </div>
  </div>
);

// ─────────── DOCUMENTS ───────────
const DOCS = [
  { id:'COM-GDPR',    cat:'Compliance', title:'How we interpret GDPR Article 17 — right to erasure', author:'Maya Patel',     updated:'2026-04-22', cites: 38, lastCited:'2h ago', tags:['GDPR','privacy'] },
  { id:'COM-PCI',     cat:'Compliance', title:'PCI-DSS scope minimisation principles',               author:'Maya Patel',     updated:'2026-03-11', cites: 14, lastCited:'1d ago',  tags:['PCI','payments'] },
  { id:'COM-SOX',     cat:'Compliance', title:'SOX evidence collection — engineering responsibilities', author:'Finance & Eng', updated:'2026-02-28', cites:  6, lastCited:'4d ago', tags:['SOX'] },
  { id:'LEG-VENDOR',  cat:'Legal',      title:'Vendor T&C clauses we will not accept',               author:'Legal',          updated:'2026-04-02', cites: 11, lastCited:'5h ago',  tags:['legal','procurement'] },
  { id:'LEG-CUST-SLA', cat:'Legal',     title:'Customer SLA commitments — 99.95% portal availability', author:'Legal',         updated:'2025-12-01', cites: 27, lastCited:'12m ago', tags:['SLA','availability'] },
  { id:'SEC-BASE',    cat:'Security',   title:'Mandatory security baseline — services in scope',     author:'Security',       updated:'2026-04-15', cites: 41, lastCited:'30m ago', tags:['security','baseline'] },
  { id:'SEC-AUTH',    cat:'Security',   title:'Authentication & session standards',                  author:'Security',       updated:'2026-04-15', cites: 19, lastCited:'3h ago',  tags:['authn','session'] },
  { id:'BRAND-VOICE', cat:'Brand',      title:'Brand & comms voice — written content principles',    author:'Brand',          updated:'2025-11-08', cites:  8, lastCited:'2d ago',  tags:['copy','tone'] },
  { id:'STRAT-2026',  cat:'Strategy',   title:'2026 narrative — claims fast-track + identity unify', author:'CEO office',     updated:'2026-01-12', cites: 24, lastCited:'1d ago',  tags:['strategy','narrative'] },
  { id:'STRAT-WHY-AI', cat:'Strategy',  title:'Why we adopted agent-native development',             author:'CTO office',     updated:'2025-09-20', cites: 33, lastCited:'5h ago',  tags:['strategy','platform'] },
];

const CAT_TONE = {
  Compliance:{ c:'#A78BFA' }, Legal:{ c:'#F59E0B' }, Security:{ c:'#EF4444' }, Brand:{ c:'#EC4899' }, Strategy:{ c:'#5B8DEF' },
};

const Documents = () => {
  const [filt, setFilt] = uS_co('All');
  const cats = ['All', 'Compliance', 'Legal', 'Security', 'Brand', 'Strategy'];
  const list = filt === 'All' ? DOCS : DOCS.filter(d => d.cat === filt);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Company documents</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>Principles and policies the Spec Agent reads before drafting. Each shows usage so authors can see what's actually being applied.</div>
        </div>
        <Btn icon="plus" variant="primary">New document</Btn>
      </div>
      <div style={{ display:'flex', gap: 6, marginBottom: 12 }}>
        {cats.map(c => (
          <button key={c} className={`tab ${filt === c ? 'active' : ''}`} onClick={() => setFilt(c)}>{c}</button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.04em', display:'grid', gridTemplateColumns:'110px 1fr 130px 100px 110px 90px', gap: 12, background:'var(--raised)', borderBottom:'1px solid var(--line)' }}>
          <span>Category</span><span>Title</span><span>Author</span><span>Updated</span><span>Cited by</span><span>Last used</span>
        </div>
        {list.map((d, i) => {
          const t = CAT_TONE[d.cat];
          return (
            <div key={d.id} className="row-hover" style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'110px 1fr 130px 100px 110px 90px', gap: 12, alignItems:'center', cursor:'pointer' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background:'var(--raised-strong)', color: t.c, justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>{d.cat}</span>
              <div>
                <div style={{ fontSize: 13 }}>{d.title}</div>
                <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{d.id} · {d.tags.join(' · ')}</div>
              </div>
              <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{d.author}</span>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{d.updated}</span>
              <span style={{ fontSize: 12, color:'var(--blue-bright)' }}>{d.cites} specs</span>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{d.lastCited}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

// ─────────── GLOSSARY ───────────
const TERMS = [
  { term:'Policyholder', alias:['Customer (insurance)','Insured'], owner:'Customer domain',  body:'A person or entity who holds an active insurance policy with Northwind. Distinct from "Quote applicant" who has not yet bound coverage.', services:['policy-store','identity-svc'], related:['Quote applicant','Beneficiary'] },
  { term:'Quote applicant', alias:['Lead','Prospect'], owner:'Customer domain', body:'A person who has submitted enough information for a quote but has not bound a policy. Tracked in CRM, not policy-store.', services:['quote-svc','crm-bridge'], related:['Policyholder'] },
  { term:'Beneficiary',     alias:[],                  owner:'Policy domain',   body:'A named recipient on a life or annuity policy. Beneficiaries are NOT policyholders unless explicitly stated.', services:['policy-store'], related:['Policyholder'] },
  { term:'Reserve',         alias:['Loss reserve'],    owner:'Claims domain',    body:'An estimate of money the company may need to pay out for a known but not-yet-settled claim.', services:['adjud-engine','reserve-svc'], related:['Claim','Payout'] },
  { term:'Adjudication',    alias:['Claim decision'],  owner:'Claims domain',    body:'The process of determining whether a claim is covered, the amount payable, and routing to payout or appeal.', services:['adjud-engine','triage-svc'], related:['Claim','Reserve'] },
  { term:'CHID',            alias:['Customer hash ID'],owner:'Platform',         body:'A pseudonymous, deterministic hash of customer-id used for cross-service correlation. Cannot be reversed without identity-svc.', services:['identity-svc'], related:['Policyholder'] },
];

const Glossary = () => {
  const [open, setOpen] = uS_co(TERMS[0].term);
  const sel = TERMS.find(t => t.term === open);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Glossary</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>The single canonical definition of every business term. The Spec Agent enforces these; ambiguous use is flagged.</div>
        </div>
        <Btn icon="plus" variant="primary">New term</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 0, maxHeight: 'calc(100vh - 320px)', overflow:'auto' }}>
          <div style={{ padding: 10, borderBottom:'1px solid var(--line-soft)' }}>
            <input placeholder="Search terms…" style={{ width:'100%', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, padding:'7px 10px', color:'var(--text)', fontSize: 12 }}/>
          </div>
          {TERMS.map((t, i) => (
            <div key={t.term} onClick={() => setOpen(t.term)} className="row-hover"
              style={{ padding:'10px 14px', borderTop: i?'1px solid var(--line-soft)':'none', cursor:'pointer', background: open===t.term ? 'var(--raised)' : 'transparent', borderLeft: open===t.term ? '2px solid var(--blue-bright)' : '2px solid transparent' }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.term}</div>
              <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{t.owner} · {t.services.length} services</div>
            </div>
          ))}
        </div>

        {sel && (
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap: 10, marginBottom: 4 }}>
              <h3 style={{ margin:0, fontSize: 20, fontWeight: 600, letterSpacing:'-0.01em' }}>{sel.term}</h3>
              {sel.alias.length > 0 && <span style={{ fontSize: 11.5, color:'var(--text-mute)' }}>aka {sel.alias.join(', ')}</span>}
            </div>
            <div className="h-eyebrow" style={{ marginBottom: 12 }}>{sel.owner}</div>
            <p style={{ fontSize: 13.5, color:'var(--text)', lineHeight: 1.65, margin:'0 0 18px' }}>{sel.body}</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18 }}>
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>Realised in services</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
                  {sel.services.map(s => <span key={s} className="chip mono" style={{ fontSize: 10.5 }}>{s}</span>)}
                </div>
              </div>
              <div>
                <div className="h-eyebrow" style={{ marginBottom: 6 }}>Related terms</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
                  {sel.related.map(r => <span key={r} className="chip" style={{ fontSize: 10.5 }}>{r}</span>)}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop:'1px solid var(--line-soft)', fontSize: 11, color:'var(--text-mute)', display:'flex', gap: 14 }}>
              <span>Cited by 18 specs</span><span>·</span><span>Last referenced 24m ago</span><span>·</span><span>Disputed by 0 reviewers</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ─────────── ONTOLOGY ───────────
// SVG-drawn entity-relationship sketch + a Turtle preview pane.
const Ontology = () => {
  const [view, setView] = uS_co('graph');
  const turtle = `@prefix nw: <https://northwind.com/ont#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

nw:Customer       rdfs:subClassOf nw:Party ;
                  rdfs:label "Customer"@en .

nw:Policy         rdfs:subClassOf nw:ContractualAgreement .

nw:Customer       nw:holdsPolicy   nw:Policy ;
                  nw:hasContact    nw:ContactInfo ;
                  nw:hasIdentity   nw:Identity .

nw:Policy         nw:coversAsset   nw:Asset ;
                  nw:hasReserve    nw:Reserve ;
                  nw:hasState      nw:PolicyState .

nw:Claim          nw:filedAgainst  nw:Policy ;
                  nw:adjudicatedBy nw:Adjudication ;
                  nw:hasOutcome    nw:Outcome .

nw:Adjudication   nw:produces      nw:Reserve ;
                  nw:produces      nw:Payout .`;

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Ontology</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>How our business entities relate. Maintained as RDF/OWL; agents reason over this when generating specs.</div>
        </div>
        <div style={{ display:'flex', gap: 4 }}>
          <button className={`tab ${view==='graph'?'active':''}`} onClick={() => setView('graph')}>Graph</button>
          <button className={`tab ${view==='turtle'?'active':''}`} onClick={() => setView('turtle')}>Turtle</button>
          <button className={`tab ${view==='split'?'active':''}`} onClick={() => setView('split')}>Split</button>
        </div>
      </div>

      <div style={{ display: view==='split' ? 'grid' : 'block', gridTemplateColumns: view==='split' ? '1fr 380px' : undefined, gap: 14 }}>
        {(view==='graph' || view==='split') && (
          <div className="card" style={{ padding: 16, minHeight: 480 }}>
            <OntologyGraph/>
          </div>
        )}
        {(view==='turtle' || view==='split') && (
          <div className="card" style={{ padding: 0, overflow:'hidden' }}>
            <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--line-soft)', fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', justifyContent:'space-between' }}>
              <span>northwind.ttl</span>
              <span>{turtle.split('\n').length} lines</span>
            </div>
            <pre style={{ margin:0, padding: 14, fontSize: 11.5, fontFamily:'JetBrains Mono', color:'var(--text-dim)', lineHeight: 1.65, whiteSpace:'pre-wrap' }}>{turtle}</pre>
          </div>
        )}
      </div>
    </>
  );
};

const OntologyGraph = () => {
  // Hand-positioned ER diagram. Boxes = classes; arrows = relations.
  const nodes = [
    { id:'Party',     x: 60,  y: 60, kind:'abstract' },
    { id:'Customer',  x: 60,  y: 160, kind:'concrete' },
    { id:'Identity',  x: 220, y: 60, kind:'concrete' },
    { id:'ContactInfo', x:220, y: 260, kind:'concrete' },
    { id:'Policy',    x: 380, y: 160, kind:'concrete' },
    { id:'PolicyState', x: 380, y: 60, kind:'enum' },
    { id:'Asset',     x: 540, y: 260, kind:'concrete' },
    { id:'Reserve',   x: 540, y: 60, kind:'concrete' },
    { id:'Claim',     x: 700, y: 160, kind:'concrete' },
    { id:'Adjudication', x: 860, y: 160, kind:'process' },
    { id:'Outcome',   x: 860, y: 260, kind:'enum' },
    { id:'Payout',    x: 860, y: 60, kind:'concrete' },
  ];
  const edges = [
    { from:'Customer', to:'Party',    label:'subClassOf', dashed: true },
    { from:'Customer', to:'Identity', label:'hasIdentity' },
    { from:'Customer', to:'ContactInfo', label:'hasContact' },
    { from:'Customer', to:'Policy',   label:'holdsPolicy' },
    { from:'Policy',   to:'Asset',    label:'coversAsset' },
    { from:'Policy',   to:'Reserve',  label:'hasReserve' },
    { from:'Policy',   to:'PolicyState', label:'hasState' },
    { from:'Claim',    to:'Policy',   label:'filedAgainst' },
    { from:'Claim',    to:'Adjudication', label:'adjudicatedBy' },
    { from:'Claim',    to:'Outcome',  label:'hasOutcome' },
    { from:'Adjudication', to:'Reserve', label:'produces' },
    { from:'Adjudication', to:'Payout', label:'produces' },
  ];
  const W = 110, H = 32;
  const center = (id) => { const n = nodes.find(x => x.id === id); return n ? { cx: n.x + W/2, cy: n.y + H/2 } : null; };
  const tone = (k) => k === 'abstract' ? '#A78BFA' : k === 'enum' ? '#F59E0B' : k === 'process' ? '#5B8DEF' : '#10B981';
  return (
    <svg viewBox="0 0 1000 360" style={{ width:'100%', height: 460 }}>
      <defs>
        <marker id="arr-onto" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#5B8DEF"/>
        </marker>
      </defs>
      {edges.map((e, i) => {
        const a = center(e.from), b = center(e.to);
        if (!a || !b) return null;
        const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
        return (
          <g key={i}>
            <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke="#5B8DEF" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray={e.dashed ? '4 3' : 'none'} markerEnd="url(#arr-onto)"/>
            <rect x={mx - 38} y={my - 8} width="76" height="14" rx="2" fill="#0F1620" opacity="0.85"/>
            <text x={mx} y={my + 2.5} fontSize="9.5" textAnchor="middle" fill="#94A3B8" fontFamily="JetBrains Mono">{e.label}</text>
          </g>
        );
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={W} height={H} rx="4" fill="#1B2434" stroke={tone(n.kind)} strokeWidth="1.4"/>
          <text x={n.x + W/2} y={n.y + H/2 + 4} fontSize="12" fontWeight="500" textAnchor="middle" fill="#E5EAF2">{n.id}</text>
        </g>
      ))}
      <g transform="translate(20, 332)">
        {[
          { l:'Class',    c:'#10B981' },
          { l:'Abstract', c:'#A78BFA' },
          { l:'Enum',     c:'#F59E0B' },
          { l:'Process',  c:'#5B8DEF' },
        ].map((k, i) => (
          <g key={k.l} transform={`translate(${i*100}, 0)`}>
            <rect x="0" y="-8" width="10" height="10" rx="2" fill="#1B2434" stroke={k.c} strokeWidth="1.4"/>
            <text x="16" y="0.5" fontSize="10.5" fill="#94A3B8" fontFamily="Inter">{k.l}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

// ─────────── SERVICE RELATIONSHIPS ───────────
const ServiceRelationships = () => {
  // Force-ish layout, hand-placed. Edges have types.
  const services = [
    { id:'portal-bff',     x: 200, y: 80,  ws:['customer-portal'], primary:'customer-portal', shared: false },
    { id:'identity-svc',   x: 480, y: 80,  ws:['customer-portal','platform'], primary:'platform', shared: true },
    { id:'profile-svc',    x: 200, y: 220, ws:['customer-portal'], primary:'customer-portal', shared: false },
    { id:'consent-svc',    x: 380, y: 320, ws:['customer-portal','policy-underwriting'], primary:'customer-portal', shared: true },
    { id:'policy-store',   x: 660, y: 220, ws:['policy-underwriting'], primary:'policy-underwriting', shared: false },
    { id:'adjud-engine',   x: 820, y: 80,  ws:['fraud-claims'], primary:'fraud-claims', shared: false },
    { id:'fraud-scorer',   x: 820, y: 280, ws:['fraud-claims','platform'], primary:'fraud-claims', shared: true },
    { id:'audit-trail-svc',x: 480, y: 380, ws:['platform'], primary:'platform', shared: false },
    { id:'snowflake-ingest', x: 660, y: 380, ws:['lending-data'], primary:'lending-data', shared: false },
  ];
  const edges = [
    { from:'portal-bff',   to:'identity-svc',   kind:'calls' },
    { from:'portal-bff',   to:'profile-svc',    kind:'calls' },
    { from:'profile-svc',  to:'consent-svc',    kind:'calls' },
    { from:'consent-svc',  to:'audit-trail-svc',kind:'emits' },
    { from:'identity-svc', to:'audit-trail-svc',kind:'emits' },
    { from:'policy-store', to:'audit-trail-svc',kind:'emits' },
    { from:'adjud-engine', to:'policy-store',   kind:'shares-DB' },
    { from:'adjud-engine', to:'fraud-scorer',   kind:'depends-on' },
    { from:'fraud-scorer', to:'snowflake-ingest', kind:'reads-from' },
    { from:'profile-svc',  to:'identity-svc',   kind:'depends-on' },
  ];
  const KIND_TONE = {
    'calls':       { c:'#5B8DEF', dash:'none' },
    'emits':       { c:'#10B981', dash:'none' },
    'depends-on':  { c:'#A78BFA', dash:'none' },
    'shares-DB':   { c:'#EF4444', dash:'4 3'  },
    'reads-from':  { c:'#F59E0B', dash:'2 3'  },
    'deprecates':  { c:'#94A3B8', dash:'6 4'  },
  };

  const center = (id) => { const n = services.find(s => s.id === id); return n ? { cx: n.x, cy: n.y } : null; };

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Service relationships</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>The messy real graph. Where Org Graph shows the clean structural map, this shows what actually couples to what — including shared ownership.</div>
        </div>
        <div style={{ display:'flex', gap: 6 }}>
          <Btn size="sm" variant="ghost" icon="filter">Filter</Btn>
          <Btn size="sm" icon="download">Export GraphML</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <svg viewBox="0 0 1000 460" style={{ width:'100%', height: 520 }}>
          <defs>
            {Object.entries(KIND_TONE).map(([k, v]) => (
              <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill={v.c}/>
              </marker>
            ))}
          </defs>
          {edges.map((e, i) => {
            const a = center(e.from), b = center(e.to);
            if (!a || !b) return null;
            const t = KIND_TONE[e.kind];
            return (
              <line key={i} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={t.c} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray={t.dash} markerEnd={`url(#arr-${e.kind})`}/>
            );
          })}
          {services.map(s => (
            <g key={s.id}>
              <circle cx={s.x} cy={s.y} r="32" fill={s.shared ? 'rgba(245,158,11,0.18)' : '#1B2434'} stroke={s.shared ? '#F59E0B' : '#5B8DEF'} strokeWidth="1.6"/>
              {s.shared && <circle cx={s.x+22} cy={s.y-22} r="6" fill="#F59E0B"/>}
              {s.shared && <text x={s.x+22} y={s.y-19} fontSize="8" fontWeight="700" fill="#0F1620" textAnchor="middle">2</text>}
              <text x={s.x} y={s.y - 4} fontSize="11" fontWeight="500" fill="#E5EAF2" textAnchor="middle" fontFamily="JetBrains Mono">{s.id}</text>
              <text x={s.x} y={s.y + 9} fontSize="9" fill="#94A3B8" textAnchor="middle">{s.primary}</text>
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop:'1px solid var(--line-soft)', display:'flex', flexWrap:'wrap', gap: 16, fontSize: 11 }}>
          {Object.entries(KIND_TONE).map(([k, v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke={v.c} strokeWidth="1.5" strokeDasharray={v.dash}/></svg>
              <span style={{ color:'var(--text-dim)' }}>{k}</span>
            </div>
          ))}
          <div style={{ flex:1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius:'50%', background:'rgba(245,158,11,0.2)', border:'1.5px solid #F59E0B' }}/>
            <span style={{ color:'var(--text-dim)' }}>Multi-workspace ownership</span>
          </div>
        </div>
      </div>

      {/* Shared-ownership table */}
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h3 style={{ margin:'0 0 10px', fontSize: 13.5, fontWeight: 600 }}>Shared-ownership ledger</h3>
        <div style={{ display:'grid', gridTemplateColumns:'140px 130px 1fr 100px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.04em', paddingBottom: 8, borderBottom:'1px solid var(--line-soft)' }}>
          <span>Service</span><span>Primary</span><span>Contributors</span><span>Last clash</span>
        </div>
        {[
          { s:'identity-svc',  p:'platform', c:['customer-portal'],         clash:'4d ago — schema rename' },
          { s:'consent-svc',   p:'customer-portal', c:['policy-underwriting'], clash:'2w ago — retention rule' },
          { s:'fraud-scorer',  p:'fraud-claims',    c:['platform'],            clash:'never' },
          { s:'audit-trail-svc', p:'platform', c:['(implicit: all)'],          clash:'never' },
        ].map((r, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'140px 130px 1fr 100px', gap: 12, padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none', alignItems:'center' }}>
            <span className="mono" style={{ fontSize: 12 }}>{r.s}</span>
            <span style={{ fontSize: 12 }}>{r.p}</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>{r.c.map(x => <span key={x} className="chip" style={{ fontSize: 10.5 }}>{x}</span>)}</div>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.clash}</span>
          </div>
        ))}
      </div>
    </>
  );
};

// ─────────── BUSINESS PROCESSES ───────────
const PROCESSES = [
  { id:'BP-CLAIM-FT', name:'Motor claim — fast-track adjudication', domain:'Claims', steps: 7, lanes: 4, sla:'< 30m end-to-end' },
  { id:'BP-NEW-POL',  name:'New motor policy — quote to bind',      domain:'Policy',  steps: 9, lanes: 5, sla:'≤ 1 business day' },
  { id:'BP-GDPR-DSR', name:'GDPR data subject request fulfilment',  domain:'Compliance', steps: 6, lanes: 3, sla:'≤ 30 days (regulatory)' },
  { id:'BP-RENEW',    name:'Annual policy renewal',                 domain:'Policy',  steps: 5, lanes: 3, sla:'30d window' },
];

const BusinessProcesses = () => {
  const [open, setOpen] = uS_co(PROCESSES[0].id);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Business processes</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>Human-and-machine flows captured as BPMN swimlanes. The Spec Agent reads these to understand who is impacted by a change.</div>
        </div>
        <Btn icon="plus" variant="primary">New process</Btn>
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden', marginBottom: 14 }}>
        {PROCESSES.map((p, i) => (
          <div key={p.id} className="row-hover" onClick={() => setOpen(p.id)}
            style={{ padding:'12px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'120px 1fr 110px 80px 200px 14px', gap: 12, alignItems:'center', cursor:'pointer', background: open===p.id ? 'var(--raised)' : 'transparent' }}>
            <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.id}</span>
            <span style={{ fontSize: 13 }}>{p.name}</span>
            <span style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{p.domain}</span>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.steps} steps · {p.lanes} lanes</span>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.sla}</span>
            <Icon name="chevron-right" size={11} style={{ color:'var(--text-mute)' }}/>
          </div>
        ))}
      </div>

      {open === 'BP-CLAIM-FT' && <SwimlaneClaim/>}
      {open !== 'BP-CLAIM-FT' && <div className="card" style={{ padding: 36, textAlign:'center', color:'var(--text-mute)', fontSize: 12.5 }}>Swimlane diagram for {open} — sketch placeholder.</div>}
    </>
  );
};

const SwimlaneClaim = () => {
  const lanes = [
    { name:'Customer',     y: 30,  color:'#5B8DEF' },
    { name:'Triage agent', y: 110, color:'#10B981' },
    { name:'Fraud scorer', y: 190, color:'#A78BFA' },
    { name:'Adjudication', y: 270, color:'#F59E0B' },
  ];
  const steps = [
    { lane: 0, x: 70,  label:'Submits claim',     kind:'event' },
    { lane: 1, x: 200, label:'Validate & enrich', kind:'task' },
    { lane: 2, x: 340, label:'Score risk',        kind:'task' },
    { lane: 1, x: 480, label:'Route',             kind:'gateway' },
    { lane: 3, x: 620, label:'Auto-adjudicate',   kind:'task' },
    { lane: 0, x: 760, label:'Notification',      kind:'event' },
    { lane: 0, x: 880, label:'Settled',           kind:'end' },
  ];
  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin:'0 0 6px', fontSize: 13.5, fontWeight: 600 }}>Motor claim — fast-track adjudication</h3>
      <div style={{ fontSize: 11, color:'var(--text-mute)', marginBottom: 12 }}>Happy path. Branch on "Route" to manual queue if scorer flags ≥ 0.6.</div>
      <svg viewBox="0 0 950 360" style={{ width:'100%', height: 380 }}>
        {lanes.map((l, i) => (
          <g key={l.name}>
            <rect x="10" y={l.y} width="930" height="60" fill={i%2 ? 'rgba(255,255,255,0.015)' : 'transparent'} stroke="#22293A" strokeWidth="0.5"/>
            <rect x="10" y={l.y} width="120" height="60" fill="#1B2434" stroke="#22293A"/>
            <line x1="10" y1={l.y} x2="10" y2={l.y+60} stroke={l.color} strokeWidth="3"/>
            <text x="20" y={l.y + 35} fontSize="11.5" fill="#E5EAF2" fontWeight="500">{l.name}</text>
          </g>
        ))}
        {steps.map((s, i) => {
          const cy = lanes[s.lane].y + 30;
          if (s.kind === 'event' || s.kind === 'end')
            return (
              <g key={i}>
                <circle cx={s.x} cy={cy} r="14" fill="#1B2434" stroke={s.kind==='end' ? '#10B981':'#5B8DEF'} strokeWidth={s.kind==='end' ? 3 : 1.5}/>
                <text x={s.x} y={cy + 30} fontSize="10" fill="#94A3B8" textAnchor="middle">{s.label}</text>
              </g>
            );
          if (s.kind === 'gateway')
            return (
              <g key={i}>
                <polygon points={`${s.x},${cy-14} ${s.x+14},${cy} ${s.x},${cy+14} ${s.x-14},${cy}`} fill="#1B2434" stroke="#F59E0B" strokeWidth="1.5"/>
                <text x={s.x} y={cy+1} fontSize="11" fill="#F59E0B" textAnchor="middle">×</text>
                <text x={s.x} y={cy + 30} fontSize="10" fill="#94A3B8" textAnchor="middle">{s.label}</text>
              </g>
            );
          return (
            <g key={i}>
              <rect x={s.x - 50} y={cy - 16} width="100" height="32" rx="4" fill="#1B2434" stroke="#5B8DEF" strokeWidth="1.5"/>
              <text x={s.x} y={cy + 4} fontSize="11" fill="#E5EAF2" textAnchor="middle">{s.label}</text>
            </g>
          );
        })}
        {steps.slice(0, -1).map((s, i) => {
          const next = steps[i+1];
          const a = { x: s.x + (s.kind==='task' ? 50 : 14), y: lanes[s.lane].y + 30 };
          const b = { x: next.x - (next.kind==='task' ? 50 : 14), y: lanes[next.lane].y + 30 };
          return (
            <path key={i} d={`M${a.x} ${a.y} C${a.x+30} ${a.y}, ${b.x-30} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="#5B8DEF" strokeOpacity="0.6" strokeWidth="1.4" markerEnd="url(#bp-arr)"/>
          );
        })}
        <defs>
          <marker id="bp-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#5B8DEF"/>
          </marker>
        </defs>
      </svg>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop:'1px solid var(--line-soft)', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 12, fontSize: 11.5 }}>
        <div><span style={{ color:'var(--text-mute)' }}>Owners</span><div style={{ marginTop: 2 }}>Sarah Chen · Maya Patel</div></div>
        <div><span style={{ color:'var(--text-mute)' }}>Touched services</span><div style={{ marginTop: 2 }} className="mono">intake-svc, triage-svc, fraud-scorer, adjud-engine</div></div>
        <div><span style={{ color:'var(--text-mute)' }}>Cited by</span><div style={{ marginTop: 2 }}>9 specs · 4 ADRs</div></div>
      </div>
    </div>
  );
};

// ─────────── DATA GOVERNANCE ───────────
const DataGovernance = () => {
  const cls = (c) => {
    const m = { PII:'#A78BFA', PCI:'#F59E0B', KYC:'#10B981', PUBLIC:'#94A3B8' };
    return m[c] || '#5B8DEF';
  };
  const nodes = [
    { id:'app:portal',          x: 60,  y: 60,  kind:'source',  label:'portal-bff', tags:['PII'] },
    { id:'app:claims',          x: 60,  y: 180, kind:'source',  label:'intake-svc', tags:['PII','KYC'] },
    { id:'app:billing',         x: 60,  y: 300, kind:'source',  label:'billing-svc', tags:['PII','PCI'] },
    { id:'kafka:events',        x: 240, y: 180, kind:'transform', label:'kafka:cust.events.v3', tags:['PII'] },
    { id:'sf:raw',              x: 420, y: 60,  kind:'transform', label:'sf:raw.events',  tags:['PII'] },
    { id:'sf:claims_raw',       x: 420, y: 180, kind:'transform', label:'sf:raw.claims',  tags:['PII','KYC'] },
    { id:'sf:billing_raw',      x: 420, y: 300, kind:'transform', label:'sf:raw.billing', tags:['PII','PCI'] },
    { id:'sf:cust_360',         x: 600, y: 120, kind:'transform', label:'sf:gold.cust_360', tags:['PII','PCI','KYC'], violation: true },
    { id:'sf:fraud_features',   x: 600, y: 240, kind:'transform', label:'sf:gold.fraud_features', tags:['PII','KYC'] },
    { id:'cons:bi',             x: 800, y: 80,  kind:'consumer', label:'BI dashboards', tags:['PUBLIC'] },
    { id:'cons:fraud_model',    x: 800, y: 200, kind:'consumer', label:'fraud-scorer (training)', tags:['PII','KYC'] },
    { id:'cons:cs_export',      x: 800, y: 320, kind:'consumer', label:'CS export bucket', tags:['PII'] },
  ];
  const edges = [
    { from:'app:portal',     to:'kafka:events' },
    { from:'app:claims',     to:'kafka:events' },
    { from:'app:billing',    to:'sf:billing_raw' },
    { from:'kafka:events',   to:'sf:raw' },
    { from:'kafka:events',   to:'sf:claims_raw' },
    { from:'sf:raw',         to:'sf:cust_360' },
    { from:'sf:claims_raw',  to:'sf:cust_360' },
    { from:'sf:billing_raw', to:'sf:cust_360' },
    { from:'sf:cust_360',    to:'cons:bi' },
    { from:'sf:cust_360',    to:'cons:fraud_model' },
    { from:'sf:claims_raw',  to:'sf:fraud_features' },
    { from:'sf:fraud_features', to:'cons:fraud_model' },
    { from:'sf:cust_360',    to:'cons:cs_export' },
  ];
  const center = (id) => { const n = nodes.find(x => x.id === id); return n ? { cx: n.x + 70, cy: n.y + 18 } : null; };

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Data governance — lineage</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>Where customer data flows, what's classified along the way, and where governance rules trip.</div>
        </div>
        <div style={{ display:'flex', gap: 6 }}>
          <Btn size="sm" variant="ghost" icon="filter">By classification</Btn>
          <Btn size="sm" icon="alert">4 violations</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <svg viewBox="0 0 920 380" style={{ width:'100%', height: 460 }}>
          <defs>
            <marker id="lineage-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#5B8DEF"/>
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = center(e.from), b = center(e.to);
            if (!a || !b) return null;
            return <path key={i} d={`M${a.cx+70} ${a.cy} C${a.cx+110} ${a.cy}, ${b.cx-110} ${b.cy}, ${b.cx-70} ${b.cy}`} fill="none" stroke="#5B8DEF" strokeOpacity="0.5" strokeWidth="1.4" markerEnd="url(#lineage-arr)"/>;
          })}
          {nodes.map(n => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width="140" height="36" rx="4" fill="#1B2434" stroke={n.violation ? '#EF4444' : '#22293A'} strokeWidth={n.violation ? 1.6 : 1}/>
              <text x={n.x + 70} y={n.y + 16} fontSize="11" fill="#E5EAF2" textAnchor="middle" fontFamily="JetBrains Mono">{n.label}</text>
              <g transform={`translate(${n.x + 4}, ${n.y + 22})`}>
                {n.tags.map((t, i) => (
                  <g key={t} transform={`translate(${i * 32}, 0)`}>
                    <rect width="28" height="9" rx="2" fill={cls(t)} fillOpacity="0.25" stroke={cls(t)} strokeWidth="0.7"/>
                    <text x="14" y="7" fontSize="8" fill={cls(t)} textAnchor="middle" fontWeight="600">{t}</text>
                  </g>
                ))}
              </g>
              {n.violation && <circle cx={n.x + 134} cy={n.y + 5} r="4" fill="#EF4444"/>}
            </g>
          ))}
        </svg>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop:'1px solid var(--line-soft)', display:'flex', flexWrap:'wrap', gap: 14, fontSize: 11 }}>
          {['PII','PCI','KYC','PUBLIC'].map(t => (
            <div key={t} style={{ display:'flex', alignItems:'center', gap: 5 }}>
              <span style={{ width: 16, height: 8, background: cls(t), opacity: 0.3, borderRadius: 2, border: `1px solid ${cls(t)}` }}/>
              <span style={{ color: cls(t) }}>{t}</span>
            </div>
          ))}
          <div style={{ flex:1 }}/>
          <div style={{ display:'flex', alignItems:'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius:'50%', background:'#EF4444' }}/>
            <span style={{ color:'#FCA5A5' }}>governance violation</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <h3 style={{ margin:'0 0 10px', fontSize: 13.5, fontWeight: 600 }}>Open violations</h3>
        {[
          { ds:'sf:gold.cust_360', rule:'PCI fields must be tokenised before reaching gold tier', sev:'high', age:'2d' },
          { ds:'sf:gold.cust_360', rule:'Untagged column `device_fp` (suspected PII)',            sev:'med',  age:'5h' },
          { ds:'cons:cs_export',   rule:'Export bucket retention exceeds policy (max 30d)',       sev:'med',  age:'1d' },
          { ds:'sf:raw.events',    rule:'1 event missing CHID hash',                              sev:'low',  age:'9m' },
        ].map((v, i) => (
          <div key={i} style={{ padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'180px 1fr 80px 60px 80px', gap: 12, alignItems:'center', fontSize: 12 }}>
            <span className="mono" style={{ fontSize: 11.5 }}>{v.ds}</span>
            <span style={{ color:'var(--text-dim)' }}>{v.rule}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: v.sev==='high'?'rgba(239,68,68,0.15)':v.sev==='med'?'rgba(245,158,11,0.15)':'var(--raised)', color: v.sev==='high'?'#FCA5A5':v.sev==='med'?'#FCD34D':'var(--text-mute)', justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>{v.sev}</span>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{v.age}</span>
            <Btn size="sm">Open</Btn>
          </div>
        ))}
      </div>
    </>
  );
};

// ─────────── DOMAINS ───────────
const Domains = ({ navigate }) => (
  <>
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>Domains</h2>
      <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>The intermediate layer between Company and Workspaces. Each domain owns a slice of business capability and may tighten Company defaults for its workspaces.</div>
    </div>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 14 }}>
      {[
        { id:'customer',        name:'Customer',         lead:'Anna Lindqvist', ws: 2, services: 4, overrides: 6 },
        { id:'policy',          name:'Policy & Underwriting', lead:'Chris Okafor',   ws: 1, services: 3, overrides: 4 },
        { id:'claims',          name:'Claims',           lead:'Dimitri Volkov', ws: 1, services: 4, overrides: 8 },
        { id:'platform',        name:'Platform',         lead:'Alex Tomic',     ws: 1, services: 3, overrides: 2 },
        { id:'data-analytics',  name:'Data & Analytics', lead:'Priya Singh',    ws: 1, services: 2, overrides: 3 },
      ].map(d => (
        <div key={d.id} className="card row-hover" style={{ padding: 16, cursor:'pointer' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 8 }}>
            <div>
              <div className="h-eyebrow">Domain</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{d.name}</div>
            </div>
            <SketchBadge/>
          </div>
          <div style={{ fontSize: 12, color:'var(--text-dim)' }}>Lead: {d.lead}</div>
          <div style={{ marginTop: 10, display:'flex', gap: 10, fontSize: 11, color:'var(--text-mute)' }}>
            <span>{d.ws} workspaces</span><span>·</span><span>{d.services} services</span><span>·</span><span>{d.overrides} cascade overrides</span>
          </div>
        </div>
      ))}
    </div>
  </>
);

window.Company = Company;

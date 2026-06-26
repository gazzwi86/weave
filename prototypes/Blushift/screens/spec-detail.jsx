/* global React, Icon, Btn, Avatar */
const { useState: uS_sd } = React;

const SPEC_DATA = {
  'SPEC-2026-018': {
    id:'SPEC-2026-018',
    title:'Promo code engine — multi-tier stacking',
    state:'In review',
    author:'Spec Agent',
    workspace:'customer-portal',
    workspaceName:'Customer Portal',
    created:'2026-05-04',
    updated:'1h ago',
    lines: 412,
    summary:'A pricing-time engine that resolves multi-tier promo code stacks (e.g. percent-off + free-shipping + loyalty) with deterministic precedence, price-floor guards, and audit-grade explainability.',
    motivation:'Today the portal short-circuits to a single best promo and silently drops others, costing a measurable conversion bump and confusing CS agents during refunds. The new engine reaches parity with our 2018 monolith but with deterministic, testable rules.',
    sections: [
      { h:'Problem', body:'When a customer presents two stackable promos (e.g. SUMMER10 + LOYALTY5), the cart-svc resolves only the highest-discount code and drops the rest. CS Tier-2 sees ~120 tickets/wk asking "where did my code go". Refund flows can\'t reconstruct intent.' },
      { h:'Goals',  body:'(1) Stack up to 4 promos with deterministic precedence. (2) Enforce a per-SKU price floor. (3) Emit a structured rationale per cart. (4) ≤ 12ms p99 added latency.' },
      { h:'Non-goals', body:'Loyalty-tier earn rules (separate spec). New promo authoring UI. Currency conversion logic.' },
      { h:'Design',  body:'Precedence table is configuration, not code: code-bound (SUMMER10) > customer-bound (LOYALTY5) > segment-bound (NEW_CUST) > order-level. Engine evaluates as a pure function over CartContext → Resolved. Cached on (cart hash, code set hash). Failure modes: invalid stack → reject with code-list, never silently drop.' },
      { h:'Data model', body:'Promo (id, kind, scope, percent, fixed, floor, expires_at). PromoApplication (cart_id, promo_id, applied_to_lines[], discount_value, rationale_token). Append-only.' },
      { h:'API',     body:'POST /v1/cart/{id}/promo · GET /v1/cart/{id}/promos · DELETE /v1/cart/{id}/promo/{code}. Returns 422 with applied_subset on partial stack rejection.' },
      { h:'Rollout', body:'Phase 1: shadow eval (logs only) — 7 days. Phase 2: 1% canary on /us-west. Phase 3: 50% then 100%. Auto-rollback on rationale-coverage < 99.5% or p99 latency > 18ms.' },
      { h:'Risk',    body:'Cart-svc owns price-floor today; we move that ownership to promo-engine. Mitigation: invariant test "no resolved cart < SKU floor" runs in CI + at edge.' },
    ],
    signals:['HITL pending','Critic OK','3 ADRs cited'],
    references:[
      { kind:'ADR',     title:'ADR-014: Promo precedence policy', date:'2026-05-02' },
      { kind:'Spec',    title:'SPEC-2024-072: Legacy promo monolith (deprecated)', date:'2024-08-11' },
      { kind:'Polaris', title:'PL-2026-04-22-009: Stackable promos', date:'2026-04-22' },
      { kind:'Wiki',    title:'/customer-portal/cart-svc/pricing', date:'live' },
      { kind:'Audit',   title:'42 incident retros · cart-svc / promo class', date:'live' },
    ],
    reviewers:[
      { name:'Sarah Chen',     role:'Workspace lead',    state:'approved',  comment:'Precedence table looks right — let\'s document the SUMMER10 + LOYALTY5 + NEW_CUST case explicitly.' },
      { name:'Alex Tomic',     role:'Architect',          state:'approved',  comment:'Move price-floor invariant to a shared library so cart-svc can reuse it post-migration.' },
      { name:'Critic agent',   role:'Automated critic',   state:'approved',  comment:'No ambiguity flags. 3 acceptance tests added.' },
      { name:'Maya Patel',     role:'Risk & compliance',  state:'pending',   comment:'Need a sentence on PII handling — does rationale_token contain customer-bound code text?' },
      { name:'Robin Lee',      role:'Engineer (impl)',    state:'changes',   comment:'Phase 2 should be 0.5%, not 1%. We had an incident at 1% rollout in March.' },
    ],
    timeline:[
      { t:'2026-05-04 09:14', who:'Spec Agent',  e:'Spec drafted', sub:'Auto-drafted from Snappy Request SR-018' },
      { t:'2026-05-04 09:42', who:'Critic agent',e:'Critic pass', sub:'No ambiguity flags' },
      { t:'2026-05-04 10:11', who:'Sarah Chen',  e:'Approved',     sub:'with one comment' },
      { t:'2026-05-04 11:33', who:'Alex Tomic',  e:'Approved',     sub:'with one architecture note' },
      { t:'2026-05-04 14:02', who:'Robin Lee',   e:'Requested changes', sub:'Concern about Phase 2 canary %' },
      { t:'2026-05-04 16:48', who:'Spec Agent',  e:'Revision 2 drafted', sub:'Phase 2 → 0.5%, added invariant test' },
    ],
  },
};

// Fallback for unknown ids — show a stub built from workspace fixture data.
const buildFallback = (id) => ({
  id,
  title: id.replace(/[-_]/g,' ').toLowerCase(),
  state:'Drafting',
  author:'Spec Agent',
  workspace:'customer-portal',
  workspaceName:'Customer Portal',
  created:'2026-05-01',
  updated:'recently',
  lines: 200,
  summary:'(Spec content not yet populated for this id in the prototype — showing structural template.)',
  motivation:'Auto-drafted from a Snappy Request. The motivation paragraph and per-section bodies stream in from the Spec Agent.',
  sections:[
    { h:'Problem', body:'…' }, { h:'Goals', body:'…' }, { h:'Design', body:'…' },
    { h:'API', body:'…' }, { h:'Rollout', body:'…' }, { h:'Risk', body:'…' },
  ],
  signals:['Drafting'],
  references: [],
  reviewers: [],
  timeline: [{ t:'recent', who:'Spec Agent', e:'Spec drafted', sub:'auto' }],
});

const SPEC_STATE_TONE = {
  'In review':{ bg:'var(--amber-bg)', c:'#FCD34D' },
  'Approved': { bg:'var(--green-bg)', c:'#A7F3D0' },
  'Drafting': { bg:'var(--blue-bg)',  c:'#BFDBFE' },
  'Rejected': { bg:'var(--red-bg)',   c:'#FCA5A5' },
};

const REVIEWER_TONE = {
  approved: { bg:'var(--green-bg)', c:'#A7F3D0', l:'Approved' },
  changes:  { bg:'var(--amber-bg)', c:'#FCD34D', l:'Changes requested' },
  pending:  { bg:'var(--raised)',   c:'var(--text-mute)', l:'Awaiting' },
};

const SpecDetail = ({ specId, navigate }) => {
  const spec = SPEC_DATA[specId] || buildFallback(specId);
  const [tab, setTab] = uS_sd('spec');
  const tone = SPEC_STATE_TONE[spec.state];

  return (
    <div className="page-enter" style={{ padding:'20px 24px', maxWidth: 1320, margin:'0 auto' }}>
      <div style={{ marginBottom: 14, display:'flex', alignItems:'center', gap: 8, fontSize: 12, color:'var(--text-mute)', flexWrap:'wrap' }}>
        <span onClick={() => navigate('/workspaces')} style={{ cursor:'pointer' }} className="row-hover">Workspaces</span>
        <Icon name="chevron-right" size={11}/>
        <span onClick={() => navigate(`/workspace/${spec.workspace}`)} style={{ cursor:'pointer' }} className="row-hover">{spec.workspaceName}</span>
        <Icon name="chevron-right" size={11}/>
        <span onClick={() => navigate(`/workspace/${spec.workspace}/specs`)} style={{ cursor:'pointer' }} className="row-hover">Specs</span>
        <Icon name="chevron-right" size={11}/>
        <span style={{ color:'var(--text)' }} className="mono">{spec.id}</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 16, marginBottom: 18 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap: 8, marginBottom: 6, alignItems:'center' }}>
            <span className="mono" style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{spec.id}</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: tone.bg, color: tone.c, textTransform:'uppercase', letterSpacing:'0.04em' }}>{spec.state}</span>
            {spec.signals.map((s, i) => <span key={i} className="chip" style={{ fontSize: 10 }}>{s}</span>)}
          </div>
          <h1 style={{ margin:'4px 0 6px', fontSize: 24, fontWeight: 600, lineHeight: 1.2, letterSpacing:'-0.01em' }}>{spec.title}</h1>
          <div style={{ fontSize: 13, color:'var(--text-dim)', maxWidth: 760, lineHeight: 1.5 }}>{spec.summary}</div>
          <div style={{ display:'flex', gap: 14, marginTop: 10, fontSize: 11.5, color:'var(--text-mute)' }}>
            <span>by {spec.author}</span>
            <span>·</span>
            <span>created {spec.created}</span>
            <span>·</span>
            <span>updated {spec.updated}</span>
            <span>·</span>
            <span className="mono">{spec.lines} lines</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
          <Btn variant="primary" icon="check">Approve</Btn>
          <Btn icon="alert">Request changes</Btn>
          <Btn variant="ghost" icon="branch" size="sm">Open thread</Btn>
        </div>
      </div>

      <div style={{ display:'flex', gap: 4, borderBottom:'1px solid var(--line)', marginBottom: 18 }}>
        {[
          { id:'spec',       label:'Spec' },
          { id:'reviews',    label:`Reviews (${spec.reviewers.length})` },
          { id:'timeline',   label:'Timeline' },
          { id:'references', label:`References (${spec.references.length})` },
        ].map(t => (
          <button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}
            style={{ borderBottom: tab===t.id?'2px solid var(--blue-bright)':'2px solid transparent' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'spec' && <SpecBody spec={spec}/>}
      {tab === 'reviews' && <Reviews spec={spec}/>}
      {tab === 'timeline' && <Timeline spec={spec}/>}
      {tab === 'references' && <References spec={spec}/>}
    </div>
  );
};

const SpecBody = ({ spec }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap: 24 }}>
    <div className="card" style={{ padding: 28 }}>
      <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom:'1px solid var(--line-soft)' }}>
        <div className="h-eyebrow" style={{ marginBottom: 6 }}>Motivation</div>
        <div style={{ fontSize: 13.5, color:'var(--text)', lineHeight: 1.65 }}>{spec.motivation}</div>
      </div>
      {spec.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 22 }}>
          <h2 style={{ margin:'0 0 8px', fontSize: 15, fontWeight: 600, letterSpacing:'-0.01em' }}>{s.h}</h2>
          <div style={{ fontSize: 13, color:'var(--text-dim)', lineHeight: 1.65 }}>{s.body}</div>
        </div>
      ))}
    </div>

    <div style={{ display:'flex', flexDirection:'column', gap: 14, position:'sticky', top: 70, alignSelf:'flex-start' }}>
      <div className="card" style={{ padding: 14 }}>
        <div className="h-eyebrow" style={{ marginBottom: 8 }}>Outline</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 4, fontSize: 12 }}>
          <div className="row-hover" style={{ padding:'4px 8px', borderRadius: 4, color:'var(--blue-bright)', cursor:'pointer' }}>Motivation</div>
          {spec.sections.map((s, i) => (
            <div key={i} className="row-hover" style={{ padding:'4px 8px', borderRadius: 4, color:'var(--text-dim)', cursor:'pointer' }}>{s.h}</div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div className="h-eyebrow" style={{ marginBottom: 8 }}>Quality signals</div>
        {[
          { l:'Critic — ambiguity', v:'0 flags', tone:'green' },
          { l:'Acceptance tests',   v:'8 / 8',   tone:'green' },
          { l:'ADR coverage',       v:'3 cited', tone:'green' },
          { l:'PII handling',       v:'unconfirmed', tone:'amber' },
        ].map((q, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderTop: i?'1px solid var(--line-soft)':'none', fontSize: 11.5 }}>
            <span style={{ color:'var(--text-dim)' }}>{q.l}</span>
            <span className="mono" style={{ color: q.tone==='green'?'var(--green)':'var(--amber)' }}>{q.v}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Reviews = ({ spec }) => (
  <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
    {spec.reviewers.map((r, i) => {
      const t = REVIEWER_TONE[r.state];
      return (
        <div key={i} className="card" style={{ padding: 16, borderLeft: `2px solid ${r.state==='approved'?'#10B981':r.state==='changes'?'#F59E0B':'var(--line)'}` }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Avatar name={r.name} size={26}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.role}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: t.bg, color: t.c, textTransform:'uppercase', letterSpacing:'0.04em' }}>{t.l}</span>
          </div>
          {r.comment && <div style={{ fontSize: 12.5, color:'var(--text-dim)', lineHeight: 1.55, paddingLeft: 36 }}>"{r.comment}"</div>}
        </div>
      );
    })}
    {spec.reviewers.length === 0 && <div style={{ padding: 30, textAlign:'center', fontSize: 12, color:'var(--text-mute)' }}>No reviews yet.</div>}
  </div>
);

const Timeline = ({ spec }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    {spec.timeline.map((t, i) => (
      <div key={i} style={{ padding:'14px 18px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'150px 130px 1fr', gap: 16, alignItems:'center' }}>
        <span className="mono" style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{t.t}</span>
        <span style={{ fontSize: 12, color:'var(--blue-bright)' }}>{t.who}</span>
        <div>
          <div style={{ fontSize: 13 }}>{t.e}</div>
          {t.sub && <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 2 }}>{t.sub}</div>}
        </div>
      </div>
    ))}
  </div>
);

const References = ({ spec }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    {spec.references.map((r, i) => (
      <div key={i} className="row-hover" style={{ padding:'12px 18px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'80px 1fr 100px 24px', gap: 12, alignItems:'center', cursor:'pointer' }}>
        <span className="chip" style={{ fontSize: 10.5, justifySelf:'start' }}>{r.kind}</span>
        <span style={{ fontSize: 13 }}>{r.title}</span>
        <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{r.date}</span>
        <Icon name="chevron-right" size={12} style={{ color:'var(--text-mute)' }}/>
      </div>
    ))}
    {spec.references.length === 0 && <div style={{ padding: 30, textAlign:'center', fontSize: 12, color:'var(--text-mute)' }}>No references yet.</div>}
  </div>
);

window.SpecDetail = SpecDetail;

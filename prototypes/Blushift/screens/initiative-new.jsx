/* global React, Icon, Avatar, Btn */
const { useState: uS_ni, useEffect: uE_ni } = React;

const NewInitiativeFlow = ({ navigate }) => {
  const [step, setStep] = uS_ni(0);
  const [name, setName] = uS_ni('Real-time fraud detection uplift');
  const [outcome, setOutcome] = uS_ni('Cut adversarial false-negatives by 40% in 9 months while keeping FP rate ≤ 1.2%.');
  const [horizon, setHorizon] = uS_ni('9 months · Q3 2026 → Q1 2027');
  const [briefDone, setBriefDone] = uS_ni(false);
  const [stakeApproved, setStakeApproved] = uS_ni({ exec: 'pending', risk: 'pending', finance: 'pending', tech: 'pending' });

  const steps = [
    { id:'context',     label:'Context',          icon:'sparkle' },
    { id:'brief',       label:'AI brief',         icon:'doc' },
    { id:'stakeholders',label:'Stakeholders',     icon:'list' },
    { id:'business',    label:'Business case',    icon:'graph' },
    { id:'signoff',     label:'Sign-off',         icon:'shield-check' },
  ];

  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1280, margin:'0 auto' }}>
      <div style={{ marginBottom: 14, display:'flex', alignItems:'center', gap: 8, fontSize: 12, color:'var(--text-mute)' }}>
        <span onClick={() => navigate('/organisation/transformations')} style={{ cursor:'pointer' }} className="row-hover">Transformations</span>
        <Icon name="chevron-right" size={11}/>
        <span style={{ color:'var(--text)' }}>New initiative</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom: 18 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Initiative · draft</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{name}</h1>
          <div style={{ fontSize: 13, color:'var(--text-dim)', marginTop: 4 }}>An AI-drafted programme charter, ready for stakeholder review.</div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => navigate('/organisation/transformations')}>Cancel</Btn>
          <Btn variant="ghost" icon="download">Export brief</Btn>
        </div>
      </div>

      <Stepper steps={steps} active={step} onPick={setStep}/>

      <div style={{ marginTop: 20 }}>
        {step === 0 && (
          <Context
            name={name} setName={setName}
            outcome={outcome} setOutcome={setOutcome}
            horizon={horizon} setHorizon={setHorizon}
            onNext={() => { setStep(1); setBriefDone(false); }}
          />
        )}
        {step === 1 && <AIBrief name={name} outcome={outcome} horizon={horizon} done={briefDone} setDone={setBriefDone} onNext={() => setStep(2)}/>}
        {step === 2 && <Stakeholders onNext={() => setStep(3)}/>}
        {step === 3 && <BusinessCase onNext={() => setStep(4)}/>}
        {step === 4 && <SignOff stakeApproved={stakeApproved} setStakeApproved={setStakeApproved} navigate={navigate} name={name}/>}
      </div>
    </div>
  );
};

const Stepper = ({ steps, active, onPick }) => (
  <div className="card" style={{ padding: 0, overflow:'hidden' }}>
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${steps.length}, 1fr)` }}>
      {steps.map((s, i) => {
        const isActive = i === active;
        const isDone = i < active;
        return (
          <div key={s.id} onClick={() => onPick(i)} className="row-hover"
            style={{
              padding:'14px 16px', cursor:'pointer',
              borderRight: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
              background: isActive ? 'rgba(59,130,246,0.06)' : 'transparent',
              borderTop: isActive ? '2px solid var(--blue-bright)' : '2px solid transparent',
              display:'flex', alignItems:'center', gap: 10,
            }}>
            <div style={{
              width: 24, height: 24, borderRadius: 12,
              background: isDone ? 'var(--green-bg)' : isActive ? 'var(--blue-bg)' : 'var(--raised)',
              border: `1px solid ${isDone ? '#10B981' : isActive ? 'var(--blue-bright)' : 'var(--line)'}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: 11, fontWeight: 600,
              color: isDone ? '#A7F3D0' : isActive ? '#BFDBFE' : 'var(--text-mute)',
            }}>{isDone ? '✓' : i + 1}</div>
            <div>
              <div className="h-eyebrow" style={{ marginBottom: 1, color: isActive ? 'var(--blue-bright)' : 'var(--text-mute)' }}>Step {i + 1}</div>
              <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ───────────────────────────── Step 0: Context
const Context = ({ name, setName, outcome, setOutcome, horizon, setHorizon, onNext }) => (
  <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 16 }}>
    <div className="card" style={{ padding: 20 }}>
      <div className="h-eyebrow" style={{ marginBottom: 14 }}>Tell me what you want to change</div>
      <Field label="Initiative name">
        <input className="inp" value={name} onChange={e => setName(e.target.value)} style={{ width:'100%' }}/>
      </Field>
      <Field label="Strategic outcome — what does success look like?">
        <textarea className="inp" rows={4} value={outcome} onChange={e => setOutcome(e.target.value)} style={{ width:'100%', resize:'vertical', fontFamily:'inherit' }}/>
      </Field>
      <Field label="Horizon">
        <input className="inp" value={horizon} onChange={e => setHorizon(e.target.value)} style={{ width:'100%' }}/>
      </Field>
      <Field label="Hint to the planner — anything we already know?">
        <textarea className="inp" rows={3} placeholder="e.g. 'reuse the new event-bus, avoid policy domain in this phase, must hit SOC2 Type II by Dec'" style={{ width:'100%', resize:'vertical', fontFamily:'inherit' }}/>
      </Field>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop: 8 }}>
        <Btn variant="primary" iconRight="arrow-right" onClick={onNext}>Draft brief with AI</Btn>
      </div>
    </div>

    <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>What happens next</div>
        <Tip n={1} t="AI drafts a brief"  s="Outcomes, scope, anti-scope, capability deltas, candidate workstreams, risks."/>
        <Tip n={2} t="Add stakeholders"   s="Owners and accountable parties — auto-suggested from Org Graph."/>
        <Tip n={3} t="Build the business case" s="ROI estimate from cost model + agent throughput."/>
        <Tip n={4} t="Collect sign-off"   s="Async approvals threaded through Slack + email; binding once quorum hits."/>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Similar past initiatives</div>
        {[
          { n:'Compliance & audit foundations', d:'Q2 → Q4 2026', sim:0.71, note:'Same horizon, similar SOC2 scope' },
          { n:'Lending data platform modernisation', d:'Q3 → Q2 2027', sim:0.42, note:'Cross-domain, sponsor pattern' },
        ].map((s, i) => (
          <div key={i} style={{ padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none' }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.n}</div>
            <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>{s.d} · similarity {(s.sim * 100).toFixed(0)}%</div>
            <div style={{ fontSize: 11.5, color:'var(--text-dim)', marginTop: 4, fontStyle:'italic' }}>{s.note}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Tip = ({ n, t, s }) => (
  <div style={{ display:'grid', gridTemplateColumns:'22px 1fr', gap: 10, padding:'8px 0' }}>
    <div style={{ width: 20, height: 20, borderRadius: 10, background:'var(--raised)', border:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10.5, color:'var(--text-mute)' }}>{n}</div>
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t}</div>
      <div style={{ fontSize: 11.5, color:'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{s}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

// ───────────────────────────── Step 1: AI Brief — streams in
const BRIEF_SECTIONS = [
  { h:'Outcome', body:'Cut adversarial false-negatives by 40% in 9 months while keeping FP rate ≤ 1.2%. Auto-adjudication coverage rises from 18% → 40% of incoming auto claims.' },
  { h:'In scope', body:'Real-time fraud-scorer v3, photo-evidence OCR, claimant graph features, model drift monitoring, runbook for adversarial retraining.' },
  { h:'Out of scope', body:'Property & casualty fraud (separate workstream), human-adjudicator UI redesign, third-party data brokers beyond ClearScore.' },
  { h:'Capability deltas', body:'Decisioning: Custom → Product. Fraud signals: Custom → Product. Model ops: Genesis → Custom.' },
  { h:'Candidate workstreams', body:'(1) Real-time scorer rewrite, (2) Photo OCR + adversarial detector, (3) Drift monitor + auto-retrain, (4) Adjudicator runbook + escalation.' },
  { h:'Risks', body:'Model drift on adversarial inputs (HIGH). Reg approval for full automation in CA, NY (MED). Cold-start on photo evidence corpus (MED).' },
  { h:'Suggested sponsor', body:'Dimitri Volkov — Claims domain owner. Workspace lead: Robin Lee. Architect: Alex Tomic.' },
];

const AIBrief = ({ name, outcome, horizon, done, setDone, onNext }) => {
  const [visible, setVisible] = uS_ni(0);

  uE_ni(() => {
    if (done) { setVisible(BRIEF_SECTIONS.length); return; }
    setVisible(0);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setVisible(i);
      if (i >= BRIEF_SECTIONS.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, 600);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 14 }}>
          <Icon name="sparkle" size={14} style={{ color:'#C4B5FD' }}/>
          <div className="h-eyebrow" style={{ color:'#DDD6FE' }}>Spec Agent · drafting brief</div>
          {!done && <span style={{ fontSize: 11, color:'var(--text-mute)', marginLeft: 'auto' }}>streaming…</span>}
          {done && <span style={{ fontSize: 11, color:'var(--green)', marginLeft: 'auto' }}>✓ ready for review</span>}
        </div>

        <div style={{ borderLeft: '2px solid rgba(139,92,246,0.4)', paddingLeft: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{name}</div>
          <div style={{ fontSize: 12, color:'var(--text-dim)', marginBottom: 14 }}>{horizon}</div>

          {BRIEF_SECTIONS.slice(0, visible).map((s, i) => (
            <div key={i} style={{ marginBottom: 16, opacity: 1, animation:'fadeUp 200ms ease-out' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--blue-bright)', marginBottom: 5 }}>{s.h}</div>
              <div style={{ fontSize: 13, color:'var(--text)', lineHeight: 1.55 }}>{s.body}</div>
            </div>
          ))}

          {!done && visible < BRIEF_SECTIONS.length && (
            <div style={{ display:'flex', gap: 4, alignItems:'center', color:'var(--text-mute)', fontSize: 12, marginTop: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background:'var(--blue-bright)', animation:'pulse 1s ease-in-out infinite' }}/>
              <span style={{ width: 6, height: 6, borderRadius: 3, background:'var(--blue-bright)', animation:'pulse 1s ease-in-out infinite 0.2s' }}/>
              <span style={{ width: 6, height: 6, borderRadius: 3, background:'var(--blue-bright)', animation:'pulse 1s ease-in-out infinite 0.4s' }}/>
            </div>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', marginTop: 20, gap: 8 }}>
          <Btn variant="ghost" icon="alert" disabled={!done}>Request rewrite</Btn>
          <Btn variant="primary" iconRight="arrow-right" disabled={!done} onClick={onNext}>Looks good — choose stakeholders</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Sources used</div>
        {[
          { kind:'Spec', n:'Fraud-scorer v2 RFC', d:'2025-09-14' },
          { kind:'ADR', n:'ADR-014: model rollback policy', d:'2025-11-02' },
          { kind:'Polaris', n:'PL-2026-04-22-007 — adversarial retrain cadence', d:'2026-04-22' },
          { kind:'Brief', n:'Compliance foundations — close-out', d:'2026-04-04' },
          { kind:'Wiki', n:'Claims/fraud-scorer runbook', d:'live' },
          { kind:'Audit', n:'42 incident retros (2024-26)', d:'live' },
        ].map((s, i) => (
          <div key={i} style={{ padding:'8px 0', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'auto 1fr auto', gap: 8, alignItems:'center' }}>
            <span className="chip" style={{ fontSize: 9.5 }}>{s.kind}</span>
            <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{s.n}</span>
            <span style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{s.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ───────────────────────────── Step 2: Stakeholders
const Stakeholders = ({ onNext }) => {
  const initialStakeholders = [
    { name:'Dimitri Volkov',  role:'Sponsor (Claims domain)',          required:true,  added:true, source:'auto · domain owner' },
    { name:'Robin Lee',       role:'Programme lead (workspace)',        required:true,  added:true, source:'auto · workspace lead' },
    { name:'Alex Tomic',      role:'Architect',                         required:true,  added:true, source:'auto · domain architect' },
    { name:'Maya Patel',      role:'Risk & compliance',                 required:true,  added:true, source:'auto · regulatory scope' },
    { name:'Anna Lindqvist',  role:'Identity workspace lead',           required:false, added:true, source:'auto · cross-cutting' },
    { name:'Sarah Chen',      role:'Customer workspace lead',           required:false, added:false,source:'suggested · downstream impact' },
    { name:'Priya Iyer',      role:'CFO delegate',                      required:true,  added:true, source:'auto · CapEx threshold' },
  ];
  const [stakes, setStakes] = uS_ni(initialStakeholders);
  const toggle = (i) => setStakes(s => s.map((x, j) => j === i ? { ...x, added: !x.added } : x));

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 4 }}>Stakeholder ownership</div>
          <div style={{ fontSize: 13, color:'var(--text-dim)' }}>Suggested from Org Graph based on scope, regulatory exposure, and downstream impact.</div>
        </div>
        <Btn icon="plus" variant="ghost" size="sm">Add stakeholder</Btn>
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        <div style={{ background:'var(--surface)', padding:'10px 16px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'30px 1fr 1fr 1fr 100px 90px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
          <span></span><span>Stakeholder</span><span>Role</span><span>Source</span><span>Required</span><span></span>
        </div>
        {stakes.map((s, i) => (
          <div key={i} style={{ padding:'10px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'30px 1fr 1fr 1fr 100px 90px', gap: 12, alignItems:'center', opacity: s.added ? 1 : 0.5 }}>
            <Avatar name={s.name} size={26}/>
            <span style={{ fontSize: 13 }}>{s.name}</span>
            <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{s.role}</span>
            <span style={{ fontSize: 11.5, color:'var(--text-mute)', fontStyle:'italic' }}>{s.source}</span>
            <span>
              {s.required
                ? <span style={{ fontSize: 10, fontWeight:600, color:'#FCA5A5', background:'var(--red-bg)', padding:'2px 6px', borderRadius:3, textTransform:'uppercase', letterSpacing:'0.04em' }}>Required</span>
                : <span style={{ fontSize: 10, color:'var(--text-mute)' }}>Optional</span>}
            </span>
            <button className="tab" style={{ fontSize: 11 }} onClick={() => toggle(i)} disabled={s.required}>
              {s.added ? 'Remove' : 'Add'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop: 16 }}>
        <Btn variant="primary" iconRight="arrow-right" onClick={onNext}>Build business case</Btn>
      </div>
    </div>
  );
};

// ───────────────────────────── Step 3: Business case
const BusinessCase = ({ onNext }) => {
  const lineItems = [
    { l:'Agent capacity (9 mo)', cost: 142000, source:'cost model · 4 workspaces × $3.9k/mo' },
    { l:'Cloud + data infra',    cost:  62400, source:'snowflake compute uplift, S3 evidence store' },
    { l:'External data (ClearScore)', cost: 48000, source:'contract · 9 mo' },
    { l:'Human review hours',    cost:  31200, source:'~24 hr/wk × $150 × 9 mo (frontloaded)' },
  ];
  const total = lineItems.reduce((s, x) => s + x.cost, 0);

  const benefits = [
    { l:'Fraud loss avoided', v:'~$3.2M / yr', conf:'high', source:'baseline FN rate × avg loss' },
    { l:'Adjudicator FTE redeploy', v:'4.5 FTE → triage', conf:'high', source:'40% auto coverage' },
    { l:'Customer NPS lift', v:'+8 pts (claims arm)', conf:'med', source:'cohort study, 2025' },
    { l:'Reg fines avoided', v:'$0.4–1.1M', conf:'low', source:'CA Bulletin 22-1 exposure' },
  ];

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 16 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="h-eyebrow" style={{ marginBottom: 14 }}>Cost — auto-modelled</div>
        <div className="card" style={{ padding: 0, overflow:'hidden', marginBottom: 14 }}>
          <div style={{ background:'var(--surface)', padding:'8px 14px', borderBottom:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr 120px 1.4fr', gap: 10, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight: 600 }}>
            <span>Line item</span><span style={{ textAlign:'right' }}>Cost</span><span>Source</span>
          </div>
          {lineItems.map((it, i) => (
            <div key={i} style={{ padding:'10px 14px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'1fr 120px 1.4fr', gap: 10, alignItems:'center' }}>
              <span style={{ fontSize: 12.5 }}>{it.l}</span>
              <span className="mono" style={{ fontSize: 12, textAlign:'right' }}>${it.cost.toLocaleString()}</span>
              <span style={{ fontSize: 11.5, color:'var(--text-mute)', fontStyle:'italic' }}>{it.source}</span>
            </div>
          ))}
          <div style={{ padding:'10px 14px', borderTop:'1px solid var(--line)', display:'grid', gridTemplateColumns:'1fr 120px 1.4fr', gap: 10, alignItems:'center', background:'var(--surface)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Total cost (9 mo)</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600, textAlign:'right', color:'#FCD34D' }}>${total.toLocaleString()}</span>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>+12% buffer recommended</span>
          </div>
        </div>

        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Expected benefits</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ padding: 12, border:'1px solid var(--line-soft)', borderRadius: 6, background:'var(--raised)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{b.l}</span>
                <ConfidenceTag c={b.conf}/>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color:'#A7F3D0' }}>{b.v}</div>
              <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 4, fontStyle:'italic' }}>{b.source}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 20, padding: 14, background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 11, color:'var(--text-mute)' }}>Estimated ROI · 9 mo horizon</div>
            <div style={{ fontSize: 24, fontWeight: 600, color:'#A7F3D0' }}>11.6×</div>
            <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>Payback in &lt; 4 months</div>
          </div>
          <Btn variant="primary" iconRight="arrow-right" onClick={onNext}>Send for sign-off</Btn>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Sensitivity analysis</div>
        {[
          { l:'If FN reduction is 25% (not 40%)',  d:'-22% ROI · still > 8×'   , tone:'amber' },
          { l:'If reg approval slips 6 mo',        d:'pushback to Q3 · ROI 9.1×', tone:'amber' },
          { l:'If photo OCR cost 2× modelled',     d:'total + $48k · ROI 10.4×', tone:'green' },
          { l:'If fraud loss baseline is 70% true', d:'ROI 8.1× · still positive', tone:'green' },
        ].map((s, i) => (
          <div key={i} style={{ padding:'10px 0', borderTop: i?'1px solid var(--line-soft)':'none' }}>
            <div style={{ fontSize: 12.5, color:'var(--text)' }}>{s.l}</div>
            <div style={{ fontSize: 11.5, marginTop: 3, color: s.tone === 'amber' ? 'var(--amber)' : 'var(--green)' }}>{s.d}</div>
          </div>
        ))}

        <div style={{ marginTop: 14, padding: 12, background:'var(--raised)', borderRadius: 6, border:'1px solid var(--line-soft)' }}>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Comparable initiatives</div>
          <div style={{ fontSize: 11.5, color:'var(--text-dim)', lineHeight: 1.5 }}>
            <span style={{ color:'var(--text)' }}>Compliance foundations</span> (closed Q4 '26) hit 9.4× ROI vs. 7× projection. <span style={{ color:'var(--text)' }}>Lending modernisation</span> tracking 2.1× under-budget at mid-programme.
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfidenceTag = ({ c }) => {
  const map = { high:{ bg:'var(--green-bg)', t:'#A7F3D0' }, med:{ bg:'var(--amber-bg)', t:'#FCD34D' }, low:{ bg:'var(--red-bg)', t:'#FCA5A5' } };
  return <span style={{ fontSize: 9, fontWeight: 600, padding:'1px 5px', borderRadius: 3, background: map[c].bg, color: map[c].t, textTransform:'uppercase', letterSpacing:'0.04em' }}>{c} conf</span>;
};

// ───────────────────────────── Step 4: Sign-off
const SignOff = ({ stakeApproved, setStakeApproved, navigate, name }) => {
  const reviewers = [
    { id:'exec',    name:'Dimitri Volkov',  role:'Executive sponsor',     ch:'slack',  sla:'48h' },
    { id:'risk',    name:'Maya Patel',       role:'Risk & compliance',     ch:'email',  sla:'72h' },
    { id:'finance', name:'Priya Iyer',       role:'Finance / CFO delegate',ch:'docs',   sla:'72h' },
    { id:'tech',    name:'Alex Tomic',       role:'Lead architect',        ch:'inline', sla:'48h' },
  ];
  const allApproved = reviewers.every(r => stakeApproved[r.id] === 'approved');

  const flip = (id) => {
    setStakeApproved(s => ({
      ...s,
      [id]: s[id] === 'approved' ? 'pending' : 'approved',
    }));
  };

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Final sign-off</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color:'var(--text-dim)', marginTop: 4 }}>4 stakeholders · binding once all four approve · auto-records to Audit chain</div>
      </div>

      <div className="card" style={{ padding: 0, overflow:'hidden', marginBottom: 18 }}>
        {reviewers.map((r, i) => {
          const state = stakeApproved[r.id] || 'pending';
          return (
            <div key={r.id} style={{ padding:'14px 18px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'40px 1fr 100px 90px 110px', gap: 12, alignItems:'center' }}>
              <Avatar name={r.name} size={32}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{r.role}</div>
              </div>
              <span className="chip" style={{ fontSize: 10.5, justifySelf:'start' }}>via {r.ch}</span>
              <span style={{ fontSize: 11, color:'var(--text-mute)' }}>SLA {r.sla}</span>
              <button onClick={() => flip(r.id)}
                style={{
                  padding:'5px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 600,
                  border:'1px solid', cursor:'pointer',
                  background: state === 'approved' ? 'var(--green-bg)' : 'var(--raised)',
                  borderColor: state === 'approved' ? '#10B981' : 'var(--line)',
                  color: state === 'approved' ? '#A7F3D0' : 'var(--text-dim)',
                }}>
                {state === 'approved' ? '✓ Approved' : 'Awaiting'}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', background: allApproved ? 'rgba(16,185,129,0.08)' : 'var(--raised)', border:'1px solid '+(allApproved ? '#10B981' : 'var(--line-soft)'), borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: allApproved ? '#A7F3D0' : 'var(--text)' }}>
            {allApproved ? 'Quorum reached — initiative is binding' : `${Object.values(stakeApproved).filter(v => v === 'approved').length} of ${reviewers.length} approved`}
          </div>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>
            {allApproved ? 'Auto-records to Audit · creates workspace + initial Snappy Requests' : 'Click "Awaiting" badges to demo approvals'}
          </div>
        </div>
        <Btn variant="primary" icon="shield-check" disabled={!allApproved}
          onClick={() => navigate('/organisation/transformations/lending-modernisation')}>
          {allApproved ? 'Launch initiative' : 'Awaiting approvals'}
        </Btn>
      </div>
    </div>
  );
};

window.NewInitiativeFlow = NewInitiativeFlow;

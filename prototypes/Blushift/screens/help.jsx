/* global React, Icon, Btn, Avatar */
const { useState: uS_h } = React;

const HelpScreen = ({ navigate }) => {
  const [phase, setPhase] = uS_h('triage'); // triage | replan | done

  return (
    <div className="page-enter" style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="Triage · Re-plan"
        icon="alert"
        title="Help me — something's blocking the project"
        subtitle="Describe the blocker. Blushift will pull related context from the org graph, Polaris, and prior decisions, then propose a re-plan."
        role="The panic button for in-flight projects. A diagnostic agent that ingests blockers and proposes concrete re-plans rather than just opening a ticket."
        purpose="State the blocker, review pulled context, choose between proposed re-plan options. Approving applies the new sequence to the project."
        contributes="Closes the loop on projects in flight. Without this, blockers turn into silent slippage; with it, the project graph stays current and accountable."
      />

      {phase === 'triage' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="h-eyebrow" style={{ marginBottom: 8 }}>Describe the blocker</div>
            <textarea
              defaultValue="fraud-scorer v3.2 is delayed by 2 weeks. We can't ship adjud-engine without the new score schema. Compliance review for the auto-disbursement path also hasn't started."
              rows="5"
              className="inp"
              style={{ width: '100%', resize:'vertical', padding: 12, fontSize: 12.5, lineHeight: 1.55 }}/>

            <div className="h-eyebrow" style={{ margin: '14px 0 8px' }}>Severity</div>
            <div style={{ display:'flex', gap: 6 }}>
              {['Low','Medium','High','Critical'].map((s,i) => (
                <button key={s} className={s === 'High' ? 'btn primary' : 'btn'} style={{ flex:1 }}>{s}</button>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <Btn variant="primary" icon="sparkle" onClick={() => setPhase('replan')}>Triage & propose re-plan</Btn>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>Related context</div>
            {[
              { i:'doc',     t:'ADR-014: schema versioning', s:'changes blast radius' },
              { i:'doc',     t:'PRD: Motor Fast-Track',     s:'goals & non-goals' },
              { i:'cube',    t:'fraud-scorer v3.2 PR',       s:'in review since 4 days' },
              { i:'sparkle', t:'Polaris P-2026-05-07-022',   s:'edge cache proposal — unrelated, skip' },
              { i:'user',    t:'Compliance · Nadia Iqbal',    s:'no review thread opened' },
            ].map((c,i) => (
              <div key={i} style={{ display:'flex', gap: 8, padding: '6px 0', borderTop: i?'1px solid var(--line-soft)':'none' }}>
                <Icon name={c.i} size={12} style={{ color: 'var(--text-mute)', marginTop: 2 }}/>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12 }}>{c.t}</div>
                  <div style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{c.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'replan' && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>Diagnosis</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color:'var(--text-dim)' }}>
              Two parallel blockers:
              <ol style={{ marginTop: 6, paddingLeft: 20 }}>
                <li><span style={{ color:'var(--text)' }}>fraud-scorer v3.2</span> upstream dependency is 2 weeks late. <span className="mono" style={{ color:'var(--blue-bright)' }}>adjud-engine</span> consumer schema can be stubbed and tested against contract tests in the meantime.</li>
                <li>Compliance review for auto-disbursement has no thread. This is on the project's critical path and must start now to avoid further slippage.</li>
              </ol>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14, marginBottom: 14 }}>
            <Plan
              title="Option A · Decouple & parallelise"
              recommended
              steps={[
                'Stub fraud-scorer v3.2 schema using contract tests',
                'Continue adjud-engine implementation behind FF',
                'Open Compliance review thread today',
                'Reorder canary to wait on real fraud-scorer',
              ]}
              impact="Slip: 0–3 days. Critical-path pressure relieved on Compliance side."
              owners={['Maya Patel','Nadia Iqbal']}/>
            <Plan
              title="Option B · Sequence & wait"
              steps={[
                'Pause adjud-engine work for 2 weeks',
                'Wait for fraud-scorer v3.2 GA',
                'Then start Compliance review',
              ]}
              impact="Slip: 14–21 days. Risk of further drift."
              owners={['Maya Patel']}/>
          </div>

          <div style={{ display:'flex', gap: 10, justifyContent:'flex-end' }}>
            <Btn onClick={() => setPhase('triage')}>Back</Btn>
            <Btn variant="primary" icon="check" onClick={() => setPhase('done')}>Apply Option A</Btn>
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="card" style={{ padding: 24, textAlign:'center' }}>
          <Icon name="check" size={32} style={{ color:'var(--green)' }}/>
          <h2 style={{ margin: '8px 0 4px', fontSize: 18 }}>Re-plan applied</h2>
          <div style={{ fontSize: 12.5, color:'var(--text-dim)', maxWidth: 540, margin: '0 auto 16px' }}>
            Tasks updated, owners pinged, Compliance thread opened with linked context. Project dashboard reflects the new sequence.
          </div>
          <Btn variant="primary" onClick={() => navigate('/project/csp-v2/dashboard')}>Back to project dashboard</Btn>
        </div>
      )}
    </div>
  );
};

const Plan = ({ title, recommended, steps, impact, owners }) => (
  <div className="card" style={{ padding: 14, position:'relative', borderColor: recommended ? 'rgba(59,130,246,0.5)' : 'var(--line)' }}>
    {recommended && (
      <div style={{ position:'absolute', top: -8, right: 12, padding: '2px 8px', background:'var(--blue)', color:'#fff', fontSize: 10, borderRadius: 3, letterSpacing:'0.05em', textTransform:'uppercase', fontWeight: 600 }}>Recommended</div>
    )}
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{title}</div>
    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color:'var(--text-dim)' }}>
      {steps.map(s => <li key={s}>{s}</li>)}
    </ol>
    <div style={{ marginTop: 10, fontSize: 11.5, color:'var(--text-mute)' }}>{impact}</div>
    <div style={{ marginTop: 8, display:'flex', alignItems:'center', gap: 4 }}>
      {owners.map(o => <Avatar key={o} name={o} size={20}/>)}
      <span style={{ marginLeft: 6, fontSize: 11, color:'var(--text-dim)' }}>{owners.join(' · ')}</span>
    </div>
  </div>
);

window.HelpScreen = HelpScreen;

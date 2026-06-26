/* global React, Icon, Avatar, Btn */
const { useState: uS_cm } = React;

const ChangeMgmtScreen = ({ navigate }) => {
  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="Change management → Implementation"
        icon="branch"
        title="Motor Fast-Track Claims Service"
        subtitle="Approved Snappy Request · 7-phase rollout · 5 services impacted · 3 data stores"
        role="The HITL approval surface between an approved spec and an in-flight project. Sequences the rollout, names blast radius, owners, gates, and rollback."
        purpose="Review the proposed sequence, gates, and dependencies; approve to convert the spec into a tracked project, or send back for changes."
        contributes="The bridge step in the pipeline: Snappy proposes the spec, Change Mgmt sequences and gates it, the Project Dashboard runs it."
      />

      <div style={{ display:'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Rollout sequence (mermaid)</div>
          <SequenceDiagram/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
          <Meta label="Sequencing">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
              <li>Build adjud-engine skeleton</li>
              <li>Wire fraud-scorer event</li>
              <li>Implement adjudication rules</li>
              <li>Integrate payment-svc disbursement</li>
              <li>Audit-svc telemetry hooks</li>
              <li>Staging soak (72h)</li>
              <li>Prod canary (5% → 100%)</li>
            </ol>
          </Meta>
          <Meta label="Blast radius">
            <div style={{ fontSize: 12 }}>5 services · 3 data stores affected</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 4, marginTop: 6 }}>
              {['intake-svc','fraud-scorer','adjud-engine','payment-svc','audit-svc'].map(s => <span key={s} className="chip" style={{ fontFamily:'var(--mono)' }}>{s}</span>)}
            </div>
          </Meta>
          <Meta label="Owners">
            {[
              { n:'Maya Patel',  r:'Overall' },
              { n:'Sarah Chen',  r:'Customer touchpoints' },
              { n:'Robin Lee',   r:'Platform integration' },
            ].map(o => (
              <div key={o.n} style={{ display:'flex', alignItems:'center', gap: 8, padding: '4px 0' }}>
                <Avatar name={o.n} size={20}/>
                <span style={{ fontSize: 12 }}>{o.n}</span>
                <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>· {o.r}</span>
              </div>
            ))}
          </Meta>
          <Meta label="Gates">
            {[
              { l:'Architecture review', s:'pass' },
              { l:'SOC 2 evidence',       s:'pass' },
              { l:'Staging soak',          s:'in' },
              { l:'Prod canary',           s:'wait' },
            ].map(g => (
              <div key={g.l} style={{ display:'flex', alignItems:'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span className={`dot ${g.s === 'pass' ? 'green' : g.s === 'in' ? 'blue' : 'gray'}`}/>
                <span>{g.l}</span>
                <span style={{ marginLeft:'auto', fontSize: 10.5, color: 'var(--text-mute)' }}>{g.s}</span>
              </div>
            ))}
          </Meta>
          <Meta label="Dependencies">
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>
              <li>ADR-014 schema versioning (must land first)</li>
              <li>fraud-scorer v3.2 (in flight)</li>
            </ul>
          </Meta>
          <Meta label="Rollback plan">
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              Per-step rollback documented. adjud-engine has a feature flag (<span className="mono">FF.MOTOR_FAST_TRACK</span>) — disabling reverts traffic to manual queue within 30 seconds.
            </div>
          </Meta>
        </div>
      </div>

      <div style={{ marginTop: 20, display:'flex', gap: 10, justifyContent:'flex-end' }}>
        <Btn>Request changes</Btn>
        <Btn variant="primary" icon="check" onClick={() => navigate('/project/csp-v2/dashboard')}>Approve change plan & start implementation</Btn>
      </div>
    </div>
  );
};

const Meta = ({ label, children }) => (
  <div className="card" style={{ padding: 12 }}>
    <div className="h-eyebrow" style={{ marginBottom: 8 }}>{label}</div>
    {children}
  </div>
);

const SequenceDiagram = () => {
  const actors = ['intake-svc','fraud-scorer','adjud-engine','payment-svc','audit-svc'];
  const actorX = (i) => 100 + i * 140;
  const messages = [
    { from:0, to:1, y: 90,  l: 'claim.received(motor, <£2.5k)', tone:'#60A5FA' },
    { from:1, to:2, y: 130, l: 'fraud.score(0.04) ✓ no signal', tone:'#10B981' },
    { from:2, to:2, y: 170, l: 'adjudicate() → APPROVE',         tone:'#60A5FA', self:true },
    { from:2, to:3, y: 210, l: 'disburse(£1,840.00)',            tone:'#60A5FA' },
    { from:3, to:4, y: 250, l: 'audit.append(payment_executed)', tone:'#8B5CF6' },
    { from:2, to:4, y: 290, l: 'audit.append(adjudication)',     tone:'#8B5CF6' },
    { from:0, to:0, y: 340, l: 'gate: SOC 2 evidence', tone:'#F59E0B', gate:true, self:true },
  ];
  return (
    <svg width="100%" height="380" viewBox="0 0 800 380">
      {actors.map((a, i) => (
        <g key={a}>
          <rect x={actorX(i)-55} y={20} width="110" height="32" rx="4" fill="var(--raised)" stroke="var(--line-strong)"/>
          <text x={actorX(i)} y={40} textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="#E5EAF2">{a}</text>
          <line x1={actorX(i)} y1={56} x2={actorX(i)} y2={360} stroke="var(--line)" strokeDasharray="2 4"/>
        </g>
      ))}
      {messages.map((m, i) => {
        if (m.self) {
          const x = actorX(m.from);
          return (
            <g key={i}>
              <path d={`M${x+5} ${m.y} q40 -15 40 0 q0 15 -40 15`} fill="none" stroke={m.tone} strokeWidth="1.2" markerEnd="url(#cm-arrow)"/>
              <text x={x+50} y={m.y-3} fontSize="10" fontFamily="var(--mono)" fill={m.tone}>{m.l}</text>
              {m.gate && <circle cx={x-50} cy={m.y+8} r="4" fill="var(--amber)"/>}
            </g>
          );
        }
        const x1 = actorX(m.from);
        const x2 = actorX(m.to);
        return (
          <g key={i}>
            <line x1={x1} y1={m.y} x2={x2} y2={m.y} stroke={m.tone} strokeWidth="1.2" markerEnd="url(#cm-arrow)"/>
            <text x={(x1+x2)/2} y={m.y-4} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill={m.tone}>{m.l}</text>
          </g>
        );
      })}
      <defs><marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#94A3B8"/></marker></defs>
    </svg>
  );
};

window.ChangeMgmtScreen = ChangeMgmtScreen;

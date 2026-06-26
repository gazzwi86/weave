/* global React, Icon, Btn, FIXTURES */
const { useState: uS_au } = React;

const AuditScreen = ({ navigate }) => {
  const [expanded, setExpanded] = uS_au(null);
  const entries = FIXTURES.audit.entries;

  return (
    <div className="page-enter" style={{ display:'grid', gridTemplateColumns: '1fr 320px', height: 'calc(100vh - 44px)' }}>
      <div style={{ overflow:'auto', padding: '20px 24px' }}>
        <window.PageHeader
          eyebrow="Governance · tamper-evident"
          icon="shield-check"
          title="Audit trail"
          subtitle={`Chain verified — ${FIXTURES.audit.chainEntries.toLocaleString()} entries — last verified ${FIXTURES.audit.lastVerified}`}
          role="Append-only, hash-linked record of every action an agent or human took on the system — every read, edit, bash, write, and review."
          purpose="Verify the chain, drill into a specific session or tool call, and export evidence for SOC 2, regulator, or internal review."
          contributes="The accountability backbone. Every Snappy decision, code change, and Polaris dispatch lands here so any project can be reconstructed end-to-end."
        />

        <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          <input className="inp" placeholder="Search by session…"/>
          <input className="inp" placeholder="Tool (Edit, Bash…)"/>
          <input className="inp" placeholder="Path…"/>
          <input className="inp" placeholder="Date range" defaultValue="2026-05-08"/>
        </div>

        <div className="surface" style={{ padding: '4px 0', overflow:'hidden' }}>
          {entries.map((e, i) => (
            <div key={e.n}>
              <div onClick={() => setExpanded(expanded === e.n ? null : e.n)}
                className="mono"
                style={{
                  display:'grid', gridTemplateColumns: '60px 180px 60px 1fr 14px',
                  gap: 10, padding: '7px 14px',
                  borderTop: i ? '1px solid var(--line-soft)' : 'none',
                  fontSize: 11.5,
                  cursor:'pointer',
                  background: e.flag === 'red' ? 'rgba(239,68,68,0.04)' : 'transparent',
                }}>
                <span style={{ color:'var(--text-mute)' }}>#{e.n}</span>
                <span style={{ color:'var(--text-dim)' }}>{e.t.replace('T',' ').replace('Z','')}</span>
                <span style={{ color: e.flag === 'red' ? 'var(--red)' : 'var(--blue-bright)' }}>{e.op}</span>
                <span style={{ color: e.flag === 'red' ? '#FCA5A5' : 'var(--text)', display:'flex', gap: 8 }}>
                  <span>{e.target}</span>
                  <span style={{ color: 'var(--text-mute)' }}>— {e.meta}</span>
                </span>
                <Icon name={expanded === e.n ? 'chevron-down' : 'chevron-right'} size={11} style={{ color: 'var(--text-mute)', alignSelf:'center' }}/>
              </div>
              {expanded === e.n && (
                <div style={{ padding: '10px 14px 14px', background: 'var(--bg)', borderTop: '1px solid var(--line-soft)' }}>
                  <pre className="mono" style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, color: 'var(--text-dim)' }}>
{`entry: ${e.n}
ts: ${e.t}
op: ${e.op}
target: ${e.target}
prev_hash: 0x9a4f${(e.n*7).toString(16).padStart(4,'0')}…3b2c
hash:      0x${(e.n*13).toString(16).padStart(4,'0')}c1d…9e8f
sandbox:   ${e.flag === 'red' ? 'BLOCKED' : 'pass'}
scrubber:  clean
signed_by: agent.engineer.v4.2.7
signature: 0xed25519:fa3c…bb7e`}
                  </pre>
                  <div style={{ marginTop: 8, display:'flex', gap: 6 }}>
                    <Btn size="sm" icon="chevron-up">Prev #{e.n - 1}</Btn>
                    <Btn size="sm" iconRight="chevron-down">Next #{e.n + 1}</Btn>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderLeft: '1px solid var(--line)', padding: 18, background:'var(--surface)', overflow:'auto' }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Verify</div>
        <Btn variant="primary" icon="shield-check" style={{ width:'100%' }}>Verify chain</Btn>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-mute)' }}>SHA chain over time</div>
        <div style={{ marginTop: 6, padding: 10, background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4 }}>
          <div style={{ display:'grid', gridTemplateColumns: 'repeat(40, 1fr)', gap: 2 }}>
            {[...Array(280)].map((_,i) => (
              <span key={i} style={{
                aspectRatio:'1',
                background: i === 87 ? 'var(--red)' : 'var(--green)',
                borderRadius: 1,
                opacity: 0.6 + (i%5)*0.08,
              }}/>
            ))}
          </div>
          <div style={{ marginTop: 8, display:'flex', justifyContent:'space-between', fontSize: 10, color:'var(--text-mute)' }}>
            <span>30 days ago</span>
            <span>now</span>
          </div>
        </div>

        <div className="h-eyebrow" style={{ margin: '20px 0 10px' }}>By tool</div>
        {[
          { l:'Read',  n: 1842, c:'#3B82F6' },
          { l:'Edit',  n: 1129, c:'#60A5FA' },
          { l:'Bash',  n:  712, c:'#22D3EE' },
          { l:'Write', n:  604, c:'#8B5CF6' },
          { l:'Block', n:    7, c:'#EF4444' },
        ].map(s => (
          <div key={s.l} style={{ display:'flex', alignItems:'center', gap: 8, padding: '5px 0', fontSize: 11.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }}/>
            <span>{s.l}</span>
            <div style={{ flex:1, height: 4, background: 'var(--line)', borderRadius: 2, marginLeft: 6 }}>
              <div style={{ width: `${s.n / 18.5}%`, height: '100%', background: s.c, borderRadius: 2 }}/>
            </div>
            <span className="mono" style={{ color:'var(--text-mute)', minWidth: 40, textAlign:'right' }}>{s.n.toLocaleString()}</span>
          </div>
        ))}

        <div className="h-eyebrow" style={{ margin: '20px 0 10px' }}>Stats</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8, fontSize: 12 }}>
          {[
            { l:'Total entries', v:'4,712' },
            { l:'Sessions', v:'48' },
            { l:'Scrubber findings', v:'3' },
            { l:'Sandbox blocks', v:'7' },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: 10 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{s.l}</div>
              <div className="mono" style={{ fontSize: 14, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.AuditScreen = AuditScreen;

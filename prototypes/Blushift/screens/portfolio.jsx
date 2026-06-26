/* global React, Icon, Avatar, Sparkline, Bar, Pill, Btn, StatusDot, FIXTURES, fmt */
const { useState: uS_p } = React;

const PortKPI = ({ label, value, sub, children }) => (
  <div className="card" style={{ padding: 14, minHeight: 92 }}>
    <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 10 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, letterSpacing:'-0.01em' }}>{value}</div>
        {sub && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-dim)' }}>{sub}</div>}
      </div>
      <div>{children}</div>
    </div>
  </div>
);

const PortfolioScreen = ({ navigate }) => {
  const projects = FIXTURES.projects;
  const polaris = FIXTURES.polaris.slice(0, 3);
  const acts = FIXTURES.activity;

  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="Org-wide rollup"
        title="Dashboard"
        subtitle={`${FIXTURES.org.name} — ${FIXTURES.org.domains} domains, ${FIXTURES.org.services} services, ${FIXTURES.org.stakeholders} stakeholders`}
        role="Org-wide rollup. Shows every active project, the agents working on them, and where decisions are pending."
        purpose="Scan the health of all projects, jump into one that needs attention, or kick off a new Snappy Request to start something."
        contributes="The starting point. From here you fan out into a project (Dashboard / Kanban / Tasks), Polaris discoveries, or the org-level views (Graph / Wiki / Audit)."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Filter</Btn>
          <Btn icon="sparkle" onClick={() => navigate('/snappy')}>New Snappy Request</Btn>
          <Btn icon="plus" variant="primary">Create project</Btn>
        </>}
      />

      {/* PortKPI row */}
      <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <PortKPI label="Active projects" value="3">
          <Sparkline data={[2,2,3,3,2,3,4,3,3,3]} width={64} height={28}/>
        </PortKPI>
        <PortKPI label="Token spend this month" value={<span><span className="mono">$3,082</span><span style={{ color:'var(--text-mute)', fontSize: 14, fontWeight: 500 }}> / $9,700</span></span>} sub="32% of monthly cap">
          <div style={{ width: 88 }}>
            <Bar value={32} max={100}/>
            <div className="mono" style={{ marginTop: 4, fontSize: 10, color: 'var(--text-mute)', textAlign: 'right' }}>32%</div>
          </div>
        </PortKPI>
        <PortKPI label="Avg cycle time" value={<span>2.3<span style={{ color:'var(--text-mute)', fontSize: 14, fontWeight: 500 }}> days</span></span>} sub={<span><span style={{ color: 'var(--green)' }}>↓ 12%</span> vs last month</span>}>
          <Sparkline data={[2.9,2.8,2.7,2.6,2.7,2.5,2.4,2.4,2.3,2.3]} width={64} height={28} color="#10B981" fill="rgba(16,185,129,0.15)"/>
        </PortKPI>
        <PortKPI label="Open Polaris proposals" value="12" sub="3 high-impact">
          <div style={{ display:'flex', gap: 3 }}>
            {[5,3,4,3,2,4,5,3,2,3,4,2].map((h,i) => (
              <div key={i} style={{ width: 5, height: h*4, background: i<3 ? '#8B5CF6' : 'var(--line-strong)', borderRadius: 1, alignSelf:'flex-end' }}/>
            ))}
          </div>
        </PortKPI>
      </div>

      {/* main + sidebar */}
      <div style={{ display:'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <div>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Active projects</div>
          <div className="surface" style={{ overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Project</th>
                  <th>Stack</th>
                  <th>Phase</th>
                  <th>Demo readiness</th>
                  <th>Budget burn</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="clickable" onClick={() => navigate('/project/' + p.id + '/dashboard')}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                        <Icon name="cube" size={14} style={{ color: 'var(--text-mute)' }}/>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td><span className="chip">{p.stack}</span></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                        <span style={{ fontSize: 12 }}>{p.phase}</span>
                        <div style={{ width: 64 }}><Bar value={p.phasePct} max={100}/></div>
                        <span className="mono" style={{ color:'var(--text-mute)', fontSize: 11 }}>{p.phasePct}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                        <StatusDot kind={p.demo.status}/>
                        <span style={{ fontSize: 12 }}>{p.demo.status === 'green' ? 'Green' : 'Amber'}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>· {p.demo.label}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                        <span className="mono" style={{ fontSize: 11.5 }}>{fmt.money(p.budget.used)} / {fmt.money(p.budget.cap)}</span>
                        <div style={{ width: 50 }}>
                          <Bar value={p.budget.used} max={p.budget.cap} tone={p.budget.used/p.budget.cap > 0.75 ? 'amber' : 'blue'}/>
                        </div>
                        <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{Math.round(p.budget.used/p.budget.cap*100)}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                        <Avatar name={p.owner.name} initials={p.owner.initials} size={20}/>
                        <span style={{ fontSize: 12 }}>{p.owner.name}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-eyebrow" style={{ margin: '24px 0 10px' }}>Recent activity</div>
          <div className="surface" style={{ padding: '4px 0' }}>
            {acts.map((a, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns: '8px 1fr auto',
                gap: 12, padding: '8px 14px',
                borderBottom: i < acts.length-1 ? '1px solid var(--line-soft)' : 'none',
                fontSize: 12.5,
              }}>
                <div style={{ alignSelf: 'center' }}>
                  <span className="dot" style={{ background: a.who.includes('agent') ? 'var(--blue)' : 'var(--text-mute)' }}/>
                </div>
                <div>
                  <span style={{ color: 'var(--text)' }}>{a.who}</span>
                  <span style={{ color: 'var(--text-dim)' }}> {a.what} </span>
                  {a.hash ? (
                    <span className="mono" style={{ color: 'var(--blue-bright)' }}>{a.target}</span>
                  ) : (
                    <span style={{ color: 'var(--text)' }}>{a.target}</span>
                  )}
                  {a.hash && <span className="mono" style={{ color:'var(--text-mute)', marginLeft: 8 }}>· {a.hash}</span>}
                  <div style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 2 }}>{a.project}</div>
                </div>
                <div style={{ color: 'var(--text-mute)', fontSize: 11, alignSelf: 'center' }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Polaris proposals */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
            <div className="h-eyebrow">Recent Polaris proposals</div>
            <a onClick={(e) => { e.preventDefault(); navigate('/polaris'); }} href="#/polaris" style={{ fontSize: 11, color: 'var(--blue-bright)', textDecoration:'none' }}>View all 12 →</a>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {polaris.map(p => (
              <div key={p.id} className="card hover" onClick={() => navigate('/polaris')} style={{ cursor:'pointer', padding: 12 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <Icon name="sparkle" size={12} style={{ color:'var(--purple)' }}/>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{p.id}</span>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{p.time}</span>
                </div>
                <div style={{ display:'flex', gap: 4, marginBottom: 8 }}>
                  {p.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 9.5, fontWeight: 600,
                      letterSpacing: '0.04em',
                      padding: '2px 6px', borderRadius: 3,
                      background: t.includes('HIGH') ? 'var(--purple-bg)' : t.includes('MEDIUM') ? 'var(--blue-bg)' : 'var(--raised)',
                      color: t.includes('HIGH') ? '#DDD6FE' : t.includes('MEDIUM') ? '#BFDBFE' : 'var(--text-dim)',
                      border: '1px solid ' + (t.includes('HIGH') ? 'rgba(139,92,246,0.35)' : t.includes('MEDIUM') ? 'rgba(59,130,246,0.35)' : 'var(--line)'),
                    }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text)' }}>{p.title}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>{p.evidence.length} evidence items</span>
                  <Btn size="sm" icon="bolt-fill">Dispatch</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

window.PortfolioScreen = PortfolioScreen;

/* global React, Icon, Btn, Avatar */
const { useState: uS_g, useMemo: uM_g } = React;

const DOMAINS = [
  { id: 'customer', name: 'Customer', owner: 'Sarah Chen',  hue: 210, count: 18 },
  { id: 'policy',   name: 'Policy',   owner: 'Maya Patel',   hue: 270, count: 14 },
  { id: 'claims',   name: 'Claims',   owner: 'Robin Lee',    hue: 25,  count: 16 },
  { id: 'lending',  name: 'Lending',  owner: 'Chris Okafor', hue: 160, count: 15 },
  { id: 'platform', name: 'Platform', owner: 'Alex Tomic',   hue: 195, count: 14 },
];

const CAPABILITIES = {
  customer: ['Identity & SSO','Profile mgmt','Consent','Self-service portal','Notifications','Onboarding','KYC','Comms','Preferences'],
  policy:   ['Quote engine','Underwriting','Renewals','Cancellations','Endorsements','Documents','Pricing','Distribution'],
  claims:   ['Intake','Triage','Fraud detection','Adjudication','Disbursement','Subrogation','Reserves','Appeals'],
  lending:  ['Origination','Decisioning','Loan ledger','Collections','Servicing','Payoff','Reporting','Remediation'],
  platform: ['Auth gateway','Event bus','Observability','Feature flags','Secrets','CI/CD','Sandbox','Catalog'],
};

const DATASETS = [
  { id: 'customer-pii',  name: 'Customer PII',     domain: 'customer', cls: 'restricted' },
  { id: 'policy-docs',   name: 'Policy documents', domain: 'policy',   cls: 'confidential' },
  { id: 'claims-hist',   name: 'Claims history',   domain: 'claims',   cls: 'confidential' },
  { id: 'fraud-signals', name: 'Fraud signals',    domain: 'claims',   cls: 'restricted' },
  { id: 'loan-ledger',   name: 'Loan ledger',      domain: 'lending',  cls: 'restricted' },
];

const SERVICES_PER_DOMAIN = {
  customer: ['portal-bff','identity-svc','profile-svc','notif-svc','consent-svc','onboarding-svc','kyc-adapter','comms-svc','session-svc','prefs-svc','audit-trail-svc','cust-search','cust-graph','dedup-svc','migrate-svc','support-bff','telemetry-cust','export-cust'],
  policy:   ['quote-svc','underwriter-svc','renewal-svc','cancel-svc','endorsement-svc','docs-svc','pricing-svc','distrib-svc','policy-store','policy-search','rate-cards','exclusions-svc','tax-svc','reinsure'],
  claims:   ['intake-svc','triage-svc','fraud-scorer','adjud-engine','disburse-svc','subrog-svc','reserves-svc','appeals-svc','claims-store','claims-search','evidence-svc','vendor-net','medical-svc','damage-est','liability-svc','recovery-svc'],
  lending:  ['origination-svc','decision-svc','loan-ledger-svc','collections-svc','servicing-svc','payoff-svc','reporting-svc','remed-svc','snowflake-ingest','events-loan','rate-svc','escrow-svc','statements-svc','dunning-svc','tax-loan'],
  platform: ['auth-gateway','event-bus','obs-stack','flags-svc','secrets-mgr','ci-runner','sandbox-svc','catalog-svc','wiki-svc','polaris-svc','audit-svc','identity-edge','idp-broker','telemetry'],
};

const ClassBadge = ({ cls }) => {
  const tone = cls === 'restricted' ? { bg:'var(--red-bg)', bd:'rgba(239,68,68,0.4)', c:'#FCA5A5' } :
               cls === 'confidential' ? { bg:'var(--amber-bg)', bd:'rgba(245,158,11,0.4)', c:'#FCD34D' } :
               { bg:'var(--blue-bg)', bd:'rgba(59,130,246,0.35)', c:'#BFDBFE' };
  return <span style={{ fontSize: 9, fontWeight: 600, letterSpacing:'0.04em', textTransform:'uppercase', padding:'1px 5px', borderRadius:3, background: tone.bg, border:'1px solid '+tone.bd, color: tone.c }}>{cls}</span>;
};

const OrgGraphScreen = ({ navigate }) => {
  const [view, setView] = uS_g('layered'); // layered | network
  const [selected, setSelected] = uS_g(null);
  const [hoverDomain, setHoverDomain] = uS_g(null);

  return (
    <div className="page-enter" style={{ height: 'calc(100vh - 44px)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'flex-end', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="h-eyebrow" style={{ marginBottom: 4 }}>Org-level context</div>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <Icon name="layers" size={16} style={{ color: 'var(--blue-bright)' }}/>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Org graph — Northwind Financial</h1>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              5 domains · 41 capabilities · 77 services · 47 stakeholders
            </div>
          </div>
          <div style={{ position:'relative', width: 240 }}>
            <Icon name="search" size={13} style={{ position:'absolute', left: 9, top: 8, color: 'var(--text-mute)' }}/>
            <input className="inp search" placeholder="Search nodes…"/>
          </div>
          <div style={{ display:'flex', gap: 4 }}>
            <button className={`tab ${view === 'layered' ? 'active' : ''}`} onClick={() => setView('layered')}>
              <Icon name="layers" size={13}/> Layered
            </button>
            <button className={`tab ${view === 'network' ? 'active' : ''}`} onClick={() => setView('network')}>
              <Icon name="network" size={13}/> Network
            </button>
          </div>
          <Btn icon="sparkle" onClick={() => navigate('/transformations')}>Transformations</Btn>
        </div>
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.18)',
          borderLeft: '2px solid var(--blue)',
          borderRadius: 4,
          display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14,
        }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 2 }}>What this is</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color:'var(--text-dim)' }}>The structural map of your business: domains → capabilities → datasets → services. Auto-derived from code, ownership files, and the wiki.</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 2 }}>What you do here</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color:'var(--text-dim)' }}>Browse, search, and click any node to see ownership, dependencies, and impact. Toggle Layered for hierarchy, Network for call-graph.</div>
          </div>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 2 }}>Where it fits</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color:'var(--text-dim)' }}>The grounding source for every other surface. Snappy uses it to compute blast radius; Polaris uses it to scope ideas; Change Mgmt uses it to plan rollouts.</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position:'relative', overflow: 'auto' }}>
        {view === 'layered'
          ? <LayeredView onSelect={setSelected} hoverDomain={hoverDomain} setHoverDomain={setHoverDomain}/>
          : <NetworkView onSelect={setSelected}/>}

        <button onClick={() => navigate('/snappy')} style={{
          position: 'absolute', bottom: 16, left: 16,
          display:'flex', alignItems:'center', gap: 8,
          height: 36, padding: '0 14px',
          borderRadius: 8,
          background: 'linear-gradient(180deg, #1E2740, #131A28)',
          border: '1px solid rgba(59,130,246,0.4)',
          color: 'var(--text)',
          fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5), 0 0 24px rgba(59,130,246,0.2)',
          zIndex: 5,
        }}>
          <Icon name="sparkle" size={13} style={{ color: '#93C5FD' }}/>
          Snappy request
        </button>
      </div>

      {selected && <NodeDetailPanel node={selected} onClose={() => setSelected(null)} navigate={navigate}/>}
    </div>
  );
};

// LAYERED — the differentiator
const LayeredView = ({ onSelect, hoverDomain, setHoverDomain }) => {
  // Bands stacked: Org / Domains / Capabilities / Data / Services
  return (
    <div style={{ minWidth: 1280, padding: '24px 28px 80px', display:'flex', flexDirection:'column', gap: 18 }}>
      {/* Band: Org */}
      <Band label="Organisation" icon="globe">
        <div style={{ display:'flex', justifyContent:'center' }}>
          <div onClick={() => onSelect({ kind:'org', name:'Northwind Financial' })}
            style={{
              minWidth: 320,
              padding: '12px 20px',
              border: '1px solid rgba(59,130,246,0.5)',
              background: 'linear-gradient(180deg, rgba(59,130,246,0.10), rgba(59,130,246,0.02))',
              borderRadius: 8,
              display:'flex', alignItems:'center', justifyContent:'center', gap: 10,
              cursor:'pointer',
              boxShadow: '0 0 24px rgba(59,130,246,0.15)',
            }}>
            <Icon name="globe" size={14} style={{ color:'var(--blue-bright)' }}/>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Northwind Financial</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>org.northwind.fin · est. 1987 · UK + DE</div>
            </div>
          </div>
        </div>
      </Band>

      {/* Connections org → domains */}
      <BandConnector />

      {/* Band: Domains */}
      <Band label="Domains" icon="cube">
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {DOMAINS.map(d => (
            <div key={d.id}
              onMouseEnter={() => setHoverDomain(d.id)}
              onMouseLeave={() => setHoverDomain(null)}
              onClick={() => onSelect({ kind: 'domain', ...d })}
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                background: `linear-gradient(180deg, hsla(${d.hue} 60% 50% / 0.12), hsla(${d.hue} 60% 50% / 0.03))`,
                border: `1px solid hsla(${d.hue} 60% 50% / 0.4)`,
                cursor:'pointer',
                outline: hoverDomain === d.id ? `1px solid hsla(${d.hue} 70% 60% / 0.7)` : 'none',
                outlineOffset: 1,
              }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                <Avatar name={d.owner} size={18}/>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                {d.count} services · owner {d.owner}
              </div>
            </div>
          ))}
        </div>
      </Band>

      <BandConnector domains/>

      {/* Band: Capabilities */}
      <Band label="Capabilities · 41" icon="sparkle">
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {DOMAINS.map(d => (
            <div key={d.id} style={{
              padding: 10,
              border: `1px dashed hsla(${d.hue} 60% 50% / 0.25)`,
              borderRadius: 6,
              background: 'var(--surface)',
              opacity: hoverDomain && hoverDomain !== d.id ? 0.4 : 1,
              transition: 'opacity 120ms',
            }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
                {CAPABILITIES[d.id].map(c => (
                  <span key={c} onClick={() => onSelect({ kind:'capability', name: c, domain: d.name })}
                    style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 3,
                      background: `hsla(${d.hue} 60% 50% / 0.10)`,
                      border: `1px solid hsla(${d.hue} 60% 50% / 0.25)`,
                      color: `hsl(${d.hue} 50% 75%)`,
                      cursor: 'pointer',
                      whiteSpace:'nowrap',
                    }}>{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Band>

      <BandConnector />

      {/* Band: Data layer */}
      <Band label="Data layer" icon="database">
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {DATASETS.map(d => {
            const dom = DOMAINS.find(x => x.id === d.domain);
            return (
              <div key={d.id} onClick={() => onSelect({ kind:'data', ...d })}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: 'var(--raised)',
                  border: '1px solid var(--line-strong)',
                  display:'flex', flexDirection:'column', gap: 4,
                  cursor:'pointer',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                  <Icon name="database" size={13} style={{ color: `hsl(${dom.hue} 60% 60%)` }}/>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{d.name}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap: 6, marginTop: 2 }}>
                  <ClassBadge cls={d.cls}/>
                  <span style={{ fontSize: 10, color: 'var(--text-mute)' }} className="mono">{d.domain}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Band>

      <BandConnector />

      {/* Band: Service inventory */}
      <Band label="Service inventory · 77" icon="cube">
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {DOMAINS.map(d => (
            <div key={d.id} style={{ display:'flex', flexDirection:'column', gap: 4 }}>
              {SERVICES_PER_DOMAIN[d.id].map(s => (
                <div key={s} onClick={() => onSelect({ kind:'service', name: s, domain: d.name, hue: d.hue })}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                    fontFamily: 'var(--mono)',
                    cursor:'pointer',
                    display:'flex', alignItems:'center', gap: 6,
                    opacity: hoverDomain && hoverDomain !== d.id ? 0.35 : 1,
                    transition: 'opacity 120ms, background 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--raised)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                  <span style={{ width: 4, height: 4, borderRadius: 2, background: `hsl(${d.hue} 60% 55%)` }}/>
                  <span style={{ color: 'var(--text-dim)' }}>{s}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Band>
    </div>
  );
};

const Band = ({ label, icon, children }) => (
  <div>
    <div style={{ display:'flex', alignItems:'center', gap: 6, marginBottom: 8 }}>
      <Icon name={icon} size={11} style={{ color: 'var(--blue-bright)' }}/>
      <div style={{ fontSize: 10, color: 'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--line) 0%, transparent 100%)' }}/>
    </div>
    {children}
  </div>
);

const BandConnector = ({ domains }) => (
  <svg height="20" width="100%" style={{ display:'block' }}>
    {[...Array(domains ? 6 : 5)].map((_,i,arr) => {
      const x = ((i + 0.5) / arr.length) * 100;
      return <line key={i} x1={`${x}%`} y1="0" x2={`${x}%`} y2="20" stroke="var(--line-strong)" strokeWidth="1" strokeDasharray="2 3"/>;
    })}
  </svg>
);

// NETWORK view — force-directed-style static layout
const NetworkView = ({ onSelect }) => {
  // Pre-compute node positions in concentric rings.
  const nodes = uM_g(() => {
    const out = [];
    out.push({ kind:'org', name:'Northwind Financial', x: 600, y: 320, r: 26, color: '#3B82F6' });
    DOMAINS.forEach((d, i) => {
      const a = (i / DOMAINS.length) * Math.PI * 2 - Math.PI/2;
      const dx = 600 + Math.cos(a) * 160;
      const dy = 320 + Math.sin(a) * 160;
      out.push({ kind:'domain', name: d.name, id: d.id, hue: d.hue, x: dx, y: dy, r: 18, color: `hsl(${d.hue} 60% 55%)`, parent: 0 });
      // services around each domain
      const services = SERVICES_PER_DOMAIN[d.id].slice(0, 8);
      services.forEach((s, j) => {
        const sa = a + (j - services.length/2) * 0.16;
        out.push({ kind:'service', name: s, hue: d.hue, x: 600 + Math.cos(sa) * 320, y: 320 + Math.sin(sa) * 320, r: 5, color: `hsl(${d.hue} 50% 60%)`, parent: i + 1 });
      });
    });
    return out;
  }, []);

  return (
    <div style={{ display:'flex', height: '100%' }}>
      <div style={{ width: 220, borderRight: '1px solid var(--line)', padding: '14px 12px', background: 'var(--surface)', overflow: 'auto' }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>Filters</div>
        {[
          { l: 'Domain', opts: DOMAINS.map(d => d.name) },
          { l: 'Capability maturity', opts: ['Strategic','Core','Commodity','Genesis'] },
          { l: 'Classification', opts: ['Restricted','Confidential','Internal','Public'] },
          { l: 'Tech stack', opts: ['TypeScript','Python','Java','Go','Kotlin'] },
        ].map((g, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 500 }}>{g.l}</div>
            {g.opts.map(o => (
              <label key={o} style={{ display:'flex', alignItems:'center', gap: 6, padding: '3px 0', fontSize: 11.5, color: 'var(--text-dim)' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: 'var(--blue)' }}/>
                {o}
              </label>
            ))}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, position:'relative', overflow:'hidden', background: 'radial-gradient(circle at center, rgba(59,130,246,0.04), transparent 60%)' }}>
        <svg width="100%" height="100%" viewBox="0 0 1200 640" style={{ display:'block' }}>
          {nodes.filter(n => n.parent != null).map((n, i) => {
            const p = nodes[n.parent];
            return <line key={i} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={n.color} strokeOpacity="0.25" strokeWidth="1"/>;
          })}
          {nodes.map((n, i) => (
            <g key={i} style={{ cursor:'pointer' }} onClick={() => onSelect(n)}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} fillOpacity={n.kind==='org' ? 0.3 : n.kind==='domain' ? 0.25 : 0.5} stroke={n.color} strokeWidth="1.2"/>
              {n.kind !== 'service' && <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fill="#E5EAF2" fontWeight="600">{n.name}</text>}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

const NodeDetailPanel = ({ node, onClose, navigate }) => {
  return (
    <div className="detail-panel panel-enter">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
            <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 3, background: 'var(--blue-bg)', color: '#BFDBFE', textTransform:'uppercase', letterSpacing:'0.06em' }}>{node.kind}</span>
            <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{node.name}</span>
          </div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        {node.domain && <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-mute)' }}>Domain: <span style={{ color: 'var(--text)' }}>{node.domain}</span></div>}
      </div>
      <div style={{ padding: 16, overflow: 'auto', flex: 1, display:'flex', flexDirection:'column', gap: 14 }}>
        {node.kind === 'service' && <>
          <OGField label="Repository"><span className="mono" style={{ color:'var(--blue-bright)' }}>github.com/northwind/{node.name}</span></OGField>
          <OGField label="Owner team"><span>Customer Platform · 6 engineers</span></OGField>
          <OGField label="Tech stack"><div style={{ display:'flex', gap: 4 }}><span className="chip">TypeScript</span><span className="chip">Node 20</span><span className="chip">Postgres</span></div></OGField>
          <OGField label="Dependent services">
            <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
              {['auth-gateway','event-bus','obs-stack','identity-svc'].map(s => <span key={s} className="chip" style={{ fontFamily:'var(--mono)' }}>{s}</span>)}
            </div>
          </OGField>
          <OGField label="Related ADRs">
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.7 }}>
              <li>ADR-013 — Edge caching strategy</li>
              <li>ADR-009 — BFF/aggregation pattern</li>
              <li>ADR-004 — Auth gateway integration</li>
            </ul>
          </OGField>
          <OGField label="Related Polaris proposals">
            <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
              <div style={{ padding: '6px 8px', background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 11.5 }}>
                <span className="mono" style={{ color: 'var(--text-mute)' }}>P-2026-05-07-022</span> · Cache /api/portfolio at edge
              </div>
            </div>
          </OGField>
          <Btn icon="doc" iconRight="arrow-right" onClick={() => navigate('/wiki')}>Open in Wiki</Btn>
        </>}
        {node.kind === 'domain' && <>
          <OGField label="Owner"><div style={{ display:'flex', alignItems:'center', gap: 8 }}><Avatar name={node.owner} size={22}/> {node.owner}</div></OGField>
          <OGField label="Capabilities">{CAPABILITIES[node.id]?.length || 0}</OGField>
          <OGField label="Services">{node.count}</OGField>
          <OGField label="Active projects"><span className="mono">2</span></OGField>
        </>}
        {node.kind === 'data' && <>
          <OGField label="Classification"><ClassBadge cls={node.cls}/></OGField>
          <OGField label="Producers"><span className="mono" style={{ fontSize: 11 }}>identity-svc, profile-svc, kyc-adapter</span></OGField>
          <OGField label="Consumers"><span className="mono" style={{ fontSize: 11 }}>fraud-scorer, comms-svc, support-bff</span></OGField>
          <OGField label="Retention">7 years (regulatory)</OGField>
        </>}
        {node.kind === 'capability' && <>
          <OGField label="Maturity"><span className="chip blue">Core</span></OGField>
          <OGField label="Implementing services"><span className="mono">4 services</span></OGField>
        </>}
        {node.kind === 'org' && <>
          <OGField label="Industry">Financial Services</OGField>
          <OGField label="Headcount">3,840</OGField>
          <OGField label="Domains">5</OGField>
        </>}
      </div>
    </div>
  );
};

const OGField = ({ label, children }) => (
  <div>
    <div className="h-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 12.5 }}>{children}</div>
  </div>
);

window.OrgGraphScreen = OrgGraphScreen;

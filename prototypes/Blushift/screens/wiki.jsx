/* global React, Icon, Avatar, Btn */
const { useState: uS_w } = React;

const TREE = [
  { id:'customer', t:'Customer', kind:'domain', children: [
    { id:'portal-bff',     t:'portal-bff',     kind:'service', children:[
      { id:'overview',  t:'overview',  kind:'page', selected: true },
      { id:'decisions', t:'decisions', kind:'page' },
      { id:'changelog', t:'changelog', kind:'page' },
      { id:'faq',       t:'faq',       kind:'page' },
    ]},
    { id:'identity-svc',   t:'identity-svc',   kind:'service', children:[{ id:'i-o', t:'overview', kind:'page' },{ id:'i-d', t:'decisions', kind:'page' }] },
    { id:'profile-svc',    t:'profile-svc',    kind:'service' },
    { id:'notif-svc',      t:'notif-svc',      kind:'service' },
    { id:'consent-svc',    t:'consent-svc',    kind:'service' },
    { id:'onboarding-svc', t:'onboarding-svc', kind:'service' },
  ]},
  { id:'policy', t:'Policy', kind:'domain', children:[
    { id:'quote-svc',     t:'quote-svc',     kind:'service' },
    { id:'underwriter-svc', t:'underwriter-svc', kind:'service' },
    { id:'renewal-svc',   t:'renewal-svc',    kind:'service' },
  ]},
  { id:'claims', t:'Claims', kind:'domain', children:[
    { id:'intake-svc',    t:'intake-svc',     kind:'service' },
    { id:'fraud-scorer',  t:'fraud-scorer',   kind:'service' },
    { id:'adjud-engine',  t:'adjud-engine',   kind:'service', tag:'NEW' },
  ]},
  { id:'lending', t:'Lending', kind:'domain', children:[
    { id:'origination-svc', t:'origination-svc', kind:'service' },
    { id:'loan-ledger-svc', t:'loan-ledger-svc', kind:'service' },
    { id:'snowflake-ingest',t:'snowflake-ingest',kind:'service' },
  ]},
  { id:'platform', t:'Platform', kind:'domain', children:[
    { id:'auth-gateway',  t:'auth-gateway',   kind:'service' },
    { id:'event-bus',     t:'event-bus',      kind:'service' },
    { id:'polaris-svc',   t:'polaris-svc',    kind:'service' },
    { id:'audit-svc',     t:'audit-svc',      kind:'service' },
  ]},
];

const TreeNode = ({ node, depth = 0, selected, onSelect, expanded, onToggle }) => {
  const isOpen = expanded[node.id] !== false; // default open
  return (
    <div>
      <div onClick={() => { onSelect(node.id); if (node.children) onToggle(node.id); }}
        className="row-hover"
        style={{
          display:'flex', alignItems:'center', gap: 4,
          padding: '4px 6px', paddingLeft: 6 + depth * 12,
          fontSize: 12,
          cursor: 'pointer',
          color: selected === node.id ? 'var(--blue-bright)' : node.kind === 'domain' ? 'var(--text)' : 'var(--text-dim)',
          background: selected === node.id ? 'rgba(59,130,246,0.08)' : 'transparent',
          borderLeft: selected === node.id ? '2px solid var(--blue)' : '2px solid transparent',
          fontWeight: node.kind === 'domain' ? 600 : 400,
          fontFamily: node.kind === 'service' ? 'var(--mono)' : 'inherit',
          fontSize: node.kind === 'service' ? 11.5 : node.kind === 'page' ? 11 : 12,
        }}>
        {node.children
          ? <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={10} style={{ color: 'var(--text-mute)' }}/>
          : <span style={{ width: 10, display:'inline-block' }}/>}
        <Icon name={node.kind === 'domain' ? 'cube' : node.kind === 'service' ? 'cube' : 'doc'} size={11} style={{ color: 'var(--text-mute)' }}/>
        <span>{node.t}</span>
        {node.tag && <span className="chip blue" style={{ height: 14, fontSize: 9, padding: '0 4px' }}>{node.tag}</span>}
      </div>
      {node.children && isOpen && node.children.map(c => (
        <TreeNode key={c.id} node={c} depth={depth+1} selected={selected} onSelect={onSelect} expanded={expanded} onToggle={onToggle}/>
      ))}
    </div>
  );
};

const WikiScreen = ({ navigate }) => {
  const [selected, setSelected] = uS_w('overview');
  const [expanded, setExpanded] = uS_w({});
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !(e[id] !== false) }));

  return (
    <div className="page-enter" style={{ display:'grid', gridTemplateColumns: '220px 1fr 200px', height: 'calc(100vh - 44px)' }}>
      <div style={{ borderRight: '1px solid var(--line)', overflow:'auto', background: 'var(--surface)' }}>
        <div style={{ padding: '12px 12px 8px', display:'flex', alignItems:'center', gap: 6 }}>
          <Icon name="search" size={12} style={{ color: 'var(--text-mute)' }}/>
          <input className="inp" placeholder="Filter pages…" style={{ height: 24, fontSize: 11, padding: '0 6px', background:'var(--bg)' }}/>
        </div>
        <div style={{ padding: '4px 0' }}>
          {TREE.map(n => <TreeNode key={n.id} node={n} selected={selected} onSelect={setSelected} expanded={expanded} onToggle={toggle}/>)}
        </div>
      </div>

      <div style={{ overflow:'auto', position:'relative' }}>
        <div style={{ padding: '24px 32px', maxWidth: 820 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
            <span className="chip green"><Icon name="circle-fill" size={8}/> living</span>
            <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>last updated 12h ago by Tech-Writer agent</span>
            <div style={{ display:'flex', marginLeft:'auto' }}>
              <Avatar name="Tech-Writer" size={20}/>
              <Avatar name="Sarah Chen" size={20} style={{ marginLeft: -6 }}/>
              <Avatar name="Maya Patel" size={20} style={{ marginLeft: -6 }}/>
            </div>
          </div>
          <h1 style={{ margin: '8px 0 4px', fontSize: 26, fontWeight: 600, letterSpacing:'-0.01em' }}>portal-bff</h1>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>BFF aggregator for the customer self-service portal. Owns the read-side composition of customer, policy, and claims data into portal-shaped DTOs.</div>

          <div style={{
            padding: '10px 14px',
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.18)',
            borderLeft: '2px solid var(--blue)',
            borderRadius: 4,
            marginBottom: 18,
            display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 16,
          }}>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 3 }}>What this is</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color:'var(--text-dim)' }}>Living code wiki — every domain, service, and route has a page that the Tech-Writer agent keeps in sync with code on every PR merge.</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 3 }}>What you do here</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color:'var(--text-dim)' }}>Read the canonical explanation of any service before changing it. Edit prose; structure auto-refreshes. Cross-link to ADRs and Polaris.</div>
            </div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--blue-bright)', marginBottom: 3 }}>Where it fits</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color:'var(--text-dim)' }}>The shared knowledge substrate. Snappy, Polaris, and the Spec Agent all read from the wiki to ground their proposals in your actual system.</div>
            </div>
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 18 }}>
            <div className="h-eyebrow" style={{ marginBottom: 8 }}>Anatomy quick-view <span style={{ color:'var(--text-mute)', textTransform:'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>auto-generated</span></div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>
              <li>Aggregates 4 upstream services into 3 DTO shapes</li>
              <li>Owns 2 caches (per-user and per-policy)</li>
              <li>11 routes, 7 require authentication</li>
            </ul>
            <div style={{ marginTop: 8, display:'flex', gap: 10, fontSize: 11, color: 'var(--text-mute)' }}>
              <span className="mono">2,418 LOC</span>
              <span>·</span>
              <span>14 cross-references</span>
            </div>
          </div>

          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Cross-links</div>
          <div style={{ display:'flex', gap: 6, flexWrap:'wrap', marginBottom: 18 }}>
            {[
              { l:'calls auth-gateway', tone:'blue' },
              { l:'consumes Customer PII', tone:'red' },
              { l:'depends on event-bus', tone:'' },
              { l:'related ADR-013', tone:'' },
              { l:'Polaris P-2026-05-07-022', tone:'purple' },
            ].map((p,i) => (
              <span key={i} className={`chip ${p.tone}`} style={{ cursor:'pointer' }} onClick={() => p.tone === 'purple' ? navigate('/polaris') : navigate('/org-graph')}>
                <Icon name="arrow-right" size={9}/> {p.l}
              </span>
            ))}
          </div>

          <h2 id="purpose" style={{ fontSize: 16, margin: '16px 0 8px', fontWeight: 600 }}>Purpose</h2>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)' }}>The portal-bff exists to keep the React frontend simple. Rather than the client orchestrating calls to <span className="mono" style={{ color: 'var(--blue-bright)' }}>identity-svc</span>, <span className="mono" style={{ color: 'var(--blue-bright)' }}>profile-svc</span>, and <span className="mono" style={{ color: 'var(--blue-bright)' }}>policy-svc</span>, this BFF composes a single response shape per portal screen.</p>

          <h2 id="routes" style={{ fontSize: 16, margin: '16px 0 8px', fontWeight: 600 }}>Routes</h2>
          <pre className="mono" style={{ background: '#08101A', border: '1px solid var(--line)', borderRadius: 5, padding: 12, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
{`GET  /api/portfolio          → portfolio DTO (auth)
GET  /api/policy/:id          → policy detail DTO (auth)
GET  /api/claims              → user claims index (auth)
POST /api/promo/validate      → promo validation
GET  /api/shipping            → estimated delivery window
GET  /api/health              → liveness probe`}
          </pre>

          <h2 id="caching" style={{ fontSize: 16, margin: '16px 0 8px', fontWeight: 600 }}>Caching</h2>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)' }}>Two layers: in-process LRU (per-user, 5 min TTL) and an upstream Redis cache shared with <span className="mono" style={{ color: 'var(--blue-bright)' }}>profile-svc</span>. See <a style={{ color:'var(--blue-bright)', textDecoration:'none', cursor:'pointer' }} onClick={() => navigate('/polaris')}>Polaris P-2026-05-07-022</a> for the proposed edge cache layer.</p>

          <h2 id="history" style={{ fontSize: 16, margin: '16px 0 8px', fontWeight: 600 }}>Edit history</h2>
          <div style={{ display:'flex', flexDirection:'column' }}>
            {[
              { t:'12h ago', a:'Tech-Writer agent', m:'Auto-refresh: routes section after PR #284', ai:true },
              { t:'2d ago',  a:'Sarah Chen',        m:'Clarified caching TTL'},
              { t:'5d ago',  a:'Tech-Writer agent', m:'Initial scaffold from service code', ai:true },
              { t:'8d ago',  a:'Maya Patel',        m:'Added cross-link to ADR-013' },
            ].map((h,i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'70px 1fr', gap: 10, padding: '6px 0', borderTop:i?'1px solid var(--line-soft)':'none', fontSize: 12 }}>
                <span style={{ color:'var(--text-mute)' }}>{h.t}</span>
                <div>
                  <span style={{ color: h.ai ? 'var(--blue-bright)' : 'var(--text)' }}>{h.a}</span>
                  <span style={{ color:'var(--text-dim)' }}> — {h.m}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button style={{
          position: 'absolute', top: 16, right: 24,
          height: 28, padding: '0 10px',
          border: '1px solid var(--line-strong)',
          background: 'var(--raised)', borderRadius: 5,
          fontSize: 12, color: 'var(--text)',
          display:'flex', alignItems:'center', gap: 6,
          cursor:'pointer',
        }}><Icon name="plus" size={12}/> Edit this page</button>
      </div>

      <div style={{ borderLeft: '1px solid var(--line)', overflow:'auto', padding: '20px 14px', background:'var(--surface)' }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>On this page</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 4, fontSize: 11.5 }}>
          {[
            { l:'Anatomy quick-view', a:true },
            { l:'Cross-links' },
            { l:'Purpose' },
            { l:'Routes' },
            { l:'Caching' },
            { l:'Edit history' },
          ].map((it,i) => (
            <a key={i} style={{
              padding: '4px 8px', borderRadius: 3,
              color: it.a ? 'var(--blue-bright)' : 'var(--text-dim)',
              borderLeft: it.a ? '2px solid var(--blue)' : '2px solid transparent',
              textDecoration:'none', cursor:'pointer',
            }}>{it.l}</a>
          ))}
        </div>
      </div>
    </div>
  );
};

window.WikiScreen = WikiScreen;

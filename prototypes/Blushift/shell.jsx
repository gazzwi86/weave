/* global React, Icon, BrandMark, Avatar, Pill, Btn, Kbd */

const { useState: useS, useEffect: useE } = React;

// Hash-based routing
const useRoute = () => {
  const [hash, setHash] = useS(window.location.hash || '#/portfolio');
  useE(() => {
    const onHash = () => setHash(window.location.hash || '#/portfolio');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const path = hash.replace(/^#/, '') || '/portfolio';
  const parts = path.split('/').filter(Boolean);
  return { path, parts, navigate: (p) => { window.location.hash = '#' + p; } };
};

const NAV_TABS = [
  { id: 'dashboard',       label: 'Dashboard' },
  { id: 'workspaces',      label: 'Workspaces' },
  { id: 'organisation',    label: 'Organisation' },
  { id: 'ops',             label: 'Ops' },
  { id: 'polaris',         label: 'Polaris', badge: 7 },
  { id: 'releases',        label: 'Releases' },
  { id: 'audit',           label: 'Audit' },
  { id: 'settings',        label: 'Settings' },
];

const TopNav = ({ route, navigate, onBell, onCmd, onAvatar, notifOpen, notifCount = 4 }) => {
  const first = route.parts[0] || 'dashboard';
  const orgChildren = ['organisation','org-graph','transformations','finops'];
  const active = first === 'portfolio' ? 'dashboard'
    : (first === 'workspace' ? 'workspaces'
    : (first === 'project' ? 'workspaces'
    : (orgChildren.includes(first) ? 'organisation' : first)));
  return (
    <div className="topnav">
      <div className="brand" onClick={() => navigate('/dashboard')} style={{ marginRight: 24 }}>
        <BrandMark size={22}/>
        <span className="brand-name">blushift</span>
      </div>
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {NAV_TABS.map(t => (
          <div key={t.id} className={`tab ${active === t.id ? 'active' : ''}`} onClick={() => navigate('/' + (t.id === 'organisation' ? 'organisation/org-graph' : t.id))}>
            {t.label}
            {t.badge && (
              <span style={{
                background: 'var(--purple-bg)',
                color: '#DDD6FE',
                border: '1px solid rgba(139,92,246,0.4)',
                fontSize: 10, fontWeight: 600,
                borderRadius: 8,
                padding: '0 5px',
                minWidth: 16, height: 16,
                display: 'inline-flex', alignItems:'center', justifyContent:'center',
                marginLeft: 2,
              }}>{t.badge}</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="tab" style={{ padding: '0 8px' }} onClick={onCmd}>
          <Icon name="search" size={14}/>
          <span style={{ color: 'var(--text-mute)', fontSize: 12 }}>Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
        <button className="tab" onClick={onBell} style={{ position:'relative', padding: '0 8px' }}>
          <Icon name="bell" size={15}/>
          {notifCount > 0 && (
            <span style={{
              position:'absolute', top: 4, right: 4,
              minWidth: 14, height: 14, borderRadius: 8,
              background: 'var(--red)', color: 'white',
              fontSize: 9, fontWeight: 700,
              display:'inline-flex', alignItems:'center', justifyContent:'center',
              padding: '0 3px',
              border: '1.5px solid var(--bg)',
            }}>{notifCount}</span>
          )}
        </button>
        <button className="tab" onClick={onAvatar} style={{ padding: '0 6px', gap: 6 }}>
          <Avatar name="Jamie Reeves" initials="JR" size={20}/>
          <Icon name="chevron-down" size={11}/>
        </button>
      </div>
    </div>
  );
};

const SubNav = ({ items, active, onPick, right }) => (
  <div className="subnav">
    {items.map(item => (
      <div key={item.id} className={`subtab ${active === item.id ? 'active' : ''}`} onClick={() => onPick(item.id)}>
        {item.label}
        {item.count != null && <span style={{ color:'var(--text-mute)', fontSize:11 }}>{item.count}</span>}
      </div>
    ))}
    <div style={{ flex:1 }}/>
    {right}
  </div>
);

// Notifications dropdown
const NotificationsDropdown = ({ open, onClose, items, navigate }) => {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset: 0, zIndex: 41 }}/>
      <div style={{
        position: 'fixed', top: 44, right: 60,
        width: 420, maxHeight: '70vh',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
        zIndex: 42,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 160ms ease-out',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Notifications</div>
          <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{items.length} unread</div>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          {items.map((n, i) => (
            <div key={i} style={{
              display:'grid', gridTemplateColumns: '20px 1fr auto',
              gap: 10, padding: '10px 14px',
              borderBottom: '1px solid var(--line-soft)',
              cursor: 'pointer',
            }} className="row-hover">
              <div style={{ fontSize: 13 }}>{n.icon}</div>
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text)' }}>{n.text}</div>
                <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>{n.project} · {n.time}</div>
              </div>
              <div style={{ alignSelf:'center' }}>
                <span style={{ fontSize: 11, color: 'var(--blue)' }}>{n.cta} →</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>View all in Inbox</span>
          <Btn size="sm" iconRight="arrow-right" onClick={() => { onClose(); navigate('/inbox'); }}>Open Inbox</Btn>
        </div>
      </div>
    </>
  );
};

// Command palette
const CommandPalette = ({ open, onClose, navigate }) => {
  const [q, setQ] = useS('');
  useE(() => { if (open) setQ(''); }, [open]);
  if (!open) return null;
  const all = [
    { kind: 'Go to', label: 'Portfolio', sub: 'Home dashboard', go: '/portfolio', icon: 'list' },
    { kind: 'Go to', label: 'Org Graph', sub: 'Layered architecture', go: '/org-graph', icon: 'layers' },
    { kind: 'Go to', label: 'Polaris', sub: '12 proposals waiting', go: '/polaris', icon: 'sparkle' },
    { kind: 'Go to', label: 'Wiki', sub: 'Code wiki', go: '/wiki', icon: 'doc' },
    { kind: 'Go to', label: 'Audit', sub: '4,712 entries — verified', go: '/audit', icon: 'shield-check' },
    { kind: 'Go to', label: 'Transformations', sub: 'Multi-quarter programmes', go: '/transformations', icon: 'graph' },
    { kind: 'Project', label: 'Customer self-service portal v2', sub: 'Wave 1: Implementation 78%', go: '/project/csp-v2/dashboard', icon: 'cube' },
    { kind: 'Project', label: 'Fraud-scorer model uplift', sub: 'Wave 0: Spec review', go: '/project/fraud-uplift/dashboard', icon: 'cube' },
    { kind: 'Project', label: 'Lending Snowflake ingestion', sub: 'Wave 1: Implementation 45%', go: '/project/snowflake-ingest/dashboard', icon: 'cube' },
    { kind: 'Action', label: 'New Snappy Request',     sub: 'Build something new', go: '/snappy', icon: 'sparkle' },
    { kind: 'Action', label: 'Help me — panic',       sub: '/blushift:help-me',    go: '/help-me', icon: 'help' },
    { kind: 'Action', label: 'Replan current project',sub: '/blushift:replan',     go: '/project/csp-v2/replan', icon: 'branch' },
    { kind: 'Action', label: 'Verify audit chain',    sub: '/blushift:audit verify', go: '/audit', icon: 'shield-check' },
    { kind: 'Settings', label: 'Settings — Budgets',  sub: 'per-project caps', go: '/settings', icon: 'gear' },
  ];
  const filtered = all.filter(it => !q || (it.label + ' ' + it.sub + ' ' + it.kind).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 600, background: 'var(--surface)',
        border: '1px solid var(--line-strong)',
        borderRadius: 10, boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <Icon name="search" size={16} style={{ color: 'var(--text-mute)' }}/>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)}
            placeholder="Type a command, project, or page…"
            style={{ flex: 1, background: 'transparent', border:'none', outline:'none', color:'var(--text)', fontSize: 14 }}/>
          <Kbd>esc</Kbd>
        </div>
        <div style={{ maxHeight: 380, overflow: 'auto', padding: 6 }}>
          {filtered.map((it, i) => (
            <div key={i} className="row-hover"
              onClick={() => { navigate(it.go); onClose(); }}
              style={{ display:'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, padding: '8px 10px', borderRadius: 5, cursor:'pointer' }}>
              <div style={{ color:'var(--text-mute)', display:'flex', alignItems:'center' }}><Icon name={it.icon} size={14}/></div>
              <div>
                <div style={{ fontSize: 13 }}>{it.label}</div>
                <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{it.sub}</div>
              </div>
              <div style={{ fontSize: 10, color:'var(--text-faint)', alignSelf:'center' }}>{it.kind}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign:'center', color:'var(--text-mute)', fontSize: 12 }}>No matches</div>
          )}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display:'flex', gap:10, alignItems:'center', fontSize: 11, color:'var(--text-mute)' }}>
          <Kbd>↵</Kbd> open <Kbd>↑↓</Kbd> navigate <Kbd>esc</Kbd> close
        </div>
      </div>
    </div>
  );
};

// FAB
const HelpFAB = ({ navigate }) => (
  <button className="fab" onClick={() => navigate('/help-me')}>
    <Icon name="sparkle" size={14} style={{ color: '#C4B5FD' }}/>
    <span>Need help?</span>
  </button>
);

// Avatar dropdown
const AvatarDropdown = ({ open, onClose, navigate }) => {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset: 0, zIndex: 41 }}/>
      <div style={{
        position: 'fixed', top: 44, right: 12,
        width: 240, background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 8,
        boxShadow: '0 16px 50px rgba(0,0,0,0.6)', zIndex: 42, padding: 6,
      }}>
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Jamie Reeves</div>
          <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>jamie@northwind.fin</div>
        </div>
        <div style={{ padding: 4 }}>
          {['Settings','Identity','Compliance','Sign out'].map((it,i) => (
            <div key={i} className="row-hover"
              onClick={() => { onClose(); if (it==='Settings') navigate('/settings'); if (it==='Sign out') navigate('/login'); }}
              style={{ padding: '7px 10px', borderRadius: 5, cursor:'pointer', fontSize: 12.5 }}>{it}</div>
          ))}
        </div>
      </div>
    </>
  );
};

Object.assign(window, { useRoute, TopNav, SubNav, NotificationsDropdown, CommandPalette, HelpFAB, AvatarDropdown });

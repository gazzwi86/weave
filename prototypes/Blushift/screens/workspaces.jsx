/* global React, Icon, Btn, Avatar, Pill, FIXTURES */
const { useState: uS_ws, useMemo: uM_ws } = React;

const WorkspacesScreen = ({ navigate }) => {
  const [q, setQ] = uS_ws('');
  const [view, setView] = uS_ws('grid');
  const ws = FIXTURES.workspaces || [];
  const filtered = uM_ws(() => {
    if (!q) return ws;
    const t = q.toLowerCase();
    return ws.filter(w => (w.name + ' ' + w.description + ' ' + w.lead.name).toLowerCase().includes(t));
  }, [q, ws]);

  const totalProj = ws.reduce((s,w) => s + w.projects, 0);
  const totalSpecs = ws.reduce((s,w) => s + w.specs, 0);
  const totalWiki = ws.reduce((s,w) => s + w.wikiPages, 0);

  return (
    <div className="page-enter" style={{ padding: '20px 24px', maxWidth: 1480, margin: '0 auto' }}>
      <window.PageHeader
        eyebrow="All workspaces"
        title="Workspaces"
        subtitle={`${ws.length} workspaces · ${totalProj} active projects · ${totalSpecs} live specs · ${totalWiki} wiki pages`}
        role="A workspace is a long-lived team boundary — its own projects, specs, wiki, and contributors. Most engineers live primarily inside one."
        purpose="Browse and search all workspaces, filter by domain/health, or open one to see its projects, specs, and wiki in context."
        contributes="The unit of organisation between Org Graph (the structural map) and individual projects. Every project belongs to exactly one workspace."
        actions={<>
          <Btn icon="filter" variant="ghost" size="sm">Filter</Btn>
          <Btn icon="plus" variant="primary">New workspace</Btn>
        </>}
      />

      <div style={{ display:'flex', gap: 10, marginBottom: 18, alignItems:'center' }}>
        <div style={{ position:'relative', flex: 1, maxWidth: 480 }}>
          <Icon name="search" size={14} style={{ position:'absolute', left: 10, top: 9, color:'var(--text-mute)' }}/>
          <input className="inp" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Semantic search across all workspaces, specs, wiki pages, and PRs…"
            style={{ width: '100%', paddingLeft: 32, height: 32 }}/>
        </div>
        <span style={{ fontSize: 11, color:'var(--text-mute)' }}>e.g. "where is the consent timestamp written" or "fraud retraining cadence"</span>
        <div style={{ flex: 1 }}/>
        <div style={{ display:'flex', gap: 4 }}>
          <button className={`tab ${view==='grid'?'active':''}`} onClick={() => setView('grid')}><Icon name="layers" size={12}/> Grid</button>
          <button className={`tab ${view==='list'?'active':''}`} onClick={() => setView('list')}><Icon name="list" size={12}/> List</button>
        </div>
      </div>

      {view === 'grid' ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14 }}>
          {filtered.map(w => <WorkspaceCard key={w.id} w={w} onOpen={() => navigate(`/workspace/${w.id}`)}/>)}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow:'hidden' }}>
          {filtered.map((w, i) => (
            <div key={w.id} onClick={() => navigate(`/workspace/${w.id}`)} className="row-hover"
              style={{ padding:'14px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'40px 1fr 200px 100px 100px 100px 80px', gap: 14, alignItems:'center', cursor:'pointer' }}>
              <WSGlyph w={w} size={32}/>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{w.name}</div>
                <div style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{w.description}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                <Avatar name={w.lead.name} size={20}/><span style={{ fontSize: 12 }}>{w.lead.name}</span>
              </div>
              <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{w.projects} projects</span>
              <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{w.specs} specs</span>
              <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{w.wikiPages} wiki</span>
              <HealthDot health={w.health}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WSGlyph = ({ w, size = 44 }) => (
  <div style={{
    width: size, height: size, borderRadius: 8,
    background: `linear-gradient(135deg, hsl(${w.hue} 70% 55% / 0.25), hsl(${w.hue} 70% 35% / 0.15))`,
    border: `1px solid hsl(${w.hue} 70% 55% / 0.4)`,
    display:'flex', alignItems:'center', justifyContent:'center',
    color: `hsl(${w.hue} 80% 75%)`,
  }}>
    <Icon name={w.icon} size={size * 0.45}/>
  </div>
);

const HealthDot = ({ health }) => {
  const c = health === 'green' ? '#10B981' : health === 'amber' ? '#F59E0B' : '#EF4444';
  const label = health === 'green' ? 'Healthy' : health === 'amber' ? 'Watch' : 'Issue';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 5, fontSize: 11, color:'var(--text-dim)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 6px ${c}` }}/>{label}
    </span>
  );
};

const WorkspaceCard = ({ w, onOpen }) => (
  <div className="card row-hover" onClick={onOpen} style={{ padding: 16, cursor:'pointer', display:'flex', flexDirection:'column', gap: 12 }}>
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 10 }}>
      <div style={{ display:'flex', gap: 12, alignItems:'center', minWidth: 0 }}>
        <WSGlyph w={w}/>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>{w.name}</div>
          <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>{w.lastActive} · led by {w.lead.name}</div>
        </div>
      </div>
      <HealthDot health={w.health}/>
    </div>

    <div style={{ fontSize: 12, color:'var(--text-dim)', lineHeight: 1.5 }}>{w.description}</div>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 8 }}>
      <WSStat label="Projects" v={w.projects}/>
      <WSStat label="Specs" v={w.specs}/>
      <WSStat label="Wiki" v={w.wikiPages}/>
      <WSStat label="Polaris" v={w.openPolaris} tone={w.openPolaris > 0 ? 'purple' : null}/>
    </div>

    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 4 }}>
      <div style={{ display:'flex' }}>
        {w.contributors.slice(0,5).map((c, i) => (
          <div key={i} style={{ marginLeft: i ? -6 : 0, border: '1.5px solid var(--surface)', borderRadius: '50%' }}>
            <Avatar name={c.n} initials={c.i} size={22}/>
          </div>
        ))}
        {w.contributors.length > 5 && (
          <div style={{ marginLeft: -6, width: 22, height: 22, borderRadius: '50%', background:'var(--raised)', border:'1.5px solid var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, color:'var(--text-mute)' }}>+{w.contributors.length - 5}</div>
        )}
      </div>
      <ActivitySpark data={w.activitySpark} hue={w.hue}/>
    </div>
  </div>
);

const WSStat = ({ label, v, tone }) => (
  <div style={{ background:'var(--raised)', border:'1px solid var(--line-soft)', borderRadius: 4, padding:'6px 8px' }}>
    <div style={{ fontSize: 9.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: tone === 'purple' ? '#C4B5FD' : 'var(--text)' }}>{v}</div>
  </div>
);

const ActivitySpark = ({ data, hue }) => {
  const W = 80, H = 22;
  const max = Math.max(...data);
  return (
    <svg width={W} height={H}>
      {data.map((v, i) => {
        const h = (v / max) * (H - 2);
        return <rect key={i} x={i * (W / data.length)} y={H - h} width={(W / data.length) - 1.5} height={h} rx={1} fill={`hsl(${hue} 70% 60%)`} opacity={0.5 + (v/max)*0.5}/>;
      })}
    </svg>
  );
};

window.WorkspacesScreen = WorkspacesScreen;
window.WSGlyph = WSGlyph;
window.HealthDot = HealthDot;

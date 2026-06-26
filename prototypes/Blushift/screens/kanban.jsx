/* global React, Icon, Avatar, Btn, FIXTURES */
const { useState: uS_k } = React;

const KanbanBoard = ({ project, navigate, onPickTask, activeTask }) => {
  const [view, setView] = uS_k('kanban'); // 'kanban' | 'tree'
  const [filter, setFilter] = uS_k('All');

  const filters = ['All tasks', 'In flight', 'Blocked', 'Polaris-flagged', 'This phase'];
  const lanes = Object.keys(FIXTURES.kanban);

  const agentColor = { E: '#3B82F6', Q: '#22D3EE', R: '#8B5CF6', '•': '#475569' };

  return (
    <div className="page-enter" style={{ padding: '16px 20px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          {filters.map(f => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap: 4 }}>
          <button className={`tab ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>
            <Icon name="kanban" size={13}/> Kanban
          </button>
          <button className={`tab ${view === 'tree' ? 'active' : ''}`} onClick={() => setView('tree')}>
            <Icon name="tree" size={13}/> Task tree
          </button>
        </div>
      </div>

      {view === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(220px, 1fr))', gap: 10, flex: 1, overflow: 'auto' }}>
          {lanes.map(lane => {
            const cards = FIXTURES.kanban[lane];
            const isInProgress = lane === 'In progress';
            return (
              <div key={lane} style={{ display:'flex', flexDirection:'column', minWidth: 0 }}>
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding: '6px 8px',
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  <span>{lane}</span>
                  <span className="mono" style={{ color: 'var(--text-mute)' }}>{cards.length}</span>
                </div>
                <div style={{
                  flex: 1,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: 8,
                  display:'flex', flexDirection:'column', gap: 6,
                  overflow:'auto',
                  minHeight: 200,
                }}>
                  {cards.map(c => (
                    <div key={c.id}
                      onClick={() => onPickTask && onPickTask(c.id)}
                      className={`card-hover ${c.active ? 'glow-blue running-glow' : ''}`}
                      style={{
                        background: 'var(--raised)',
                        border: '1px solid var(--line)',
                        borderRadius: 5,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        position: 'relative',
                      }}>
                      {c.active && (
                        <div style={{ position:'absolute', top: 6, right: 6, display:'flex', alignItems:'center', gap: 4 }}>
                          <span className="dot blue"/>
                          <span style={{ fontSize: 9.5, color: 'var(--blue-bright)', fontWeight: 600, letterSpacing: '0.04em' }}>RUNNING</span>
                        </div>
                      )}
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{c.id}</div>
                      <div style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.35 }}>{c.title}</div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 8 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 4,
                          display:'inline-flex', alignItems:'center', justifyContent:'center',
                          background: agentColor[c.agent] + '22',
                          color: agentColor[c.agent],
                          fontSize: 10, fontWeight: 600,
                          border: '1px solid ' + agentColor[c.agent] + '55',
                        }}>{c.agent}</span>
                        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                          {c.retry && <span className="chip amber" style={{ height: 16, fontSize: 9.5 }}>retry 1/3</span>}
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-mute)' }}>{c.t}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <TaskTreeView onPickTask={onPickTask}/>
      )}
    </div>
  );
};

// Task Tree — distinctive visual.
const TaskTreeView = ({ onPickTask }) => {
  // Flow: epic at top, 3 subtrees. We'll render an SVG.
  const W = 1100, H = 540;
  const epic = { x: W/2, y: 40, id: 'EPIC-CSP-V2', label: 'Customer self-service portal v2', state: 'in' };
  const subepics = [
    { x: 200, y: 140, id: 'EP-001', label: 'Cart & checkout', state: 'in', count: 8 },
    { x: 550, y: 140, id: 'EP-002', label: 'Account & profile', state: 'done', count: 5 },
    { x: 900, y: 140, id: 'EP-003', label: 'Search & a11y', state: 'in', count: 7 },
  ];
  const tasks = [
    // EP-001
    { x: 80,  y: 240, id: 'TASK-024', label: 'Checkout summary', state: 'active', parent: 0 },
    { x: 200, y: 240, id: 'TASK-025', label: 'Confirmation banner', state: 'in', parent: 0 },
    { x: 320, y: 240, id: 'TASK-022', label: 'Promo code flow', state: 'review', parent: 0 },
    { x: 80,  y: 340, id: 'TASK-018', label: 'Cart drawer', state: 'done', parent: 0 },
    { x: 200, y: 340, id: 'TASK-017', label: 'Qty stepper', state: 'done', parent: 0 },
    { x: 320, y: 340, id: 'TASK-026', label: 'Tax breakdown', state: 'ready', parent: 0 },
    // EP-002
    { x: 460, y: 240, id: 'TASK-014', label: 'Profile page', state: 'done', parent: 1 },
    { x: 580, y: 240, id: 'TASK-015', label: 'Theme tokens', state: 'done', parent: 1 },
    { x: 700, y: 240, id: 'TASK-016', label: 'Toast system', state: 'done', parent: 1 },
    { x: 460, y: 340, id: 'TASK-029', label: 'PII redact', state: 'ready', parent: 1 },
    { x: 580, y: 340, id: 'TASK-034', label: 'Saved cards', state: 'backlog', parent: 1 },
    // EP-003
    { x: 820, y: 240, id: 'TASK-021', label: 'Sidebar collapse', state: 'review', parent: 2 },
    { x: 940, y: 240, id: 'TASK-023', label: 'Header search a11y', state: 'review', parent: 2 },
    { x: 820, y: 340, id: 'TASK-028', label: 'Coupon stacking', state: 'ready', parent: 2 },
    { x: 940, y: 340, id: 'TASK-031', label: 'Empty cart state', state: 'backlog', parent: 2 },
    { x: 1060,y: 340, id: 'TASK-035', label: 'Apple Pay btn', state: 'backlog', parent: 2 },
  ];

  const stateColor = {
    active:   { fill: 'rgba(59,130,246,0.18)', stroke: '#60A5FA',  text: '#BFDBFE' },
    in:       { fill: 'var(--raised)',          stroke: '#3B82F6',  text: '#E5EAF2' },
    review:   { fill: 'rgba(139,92,246,0.10)',  stroke: '#8B5CF6',  text: '#DDD6FE' },
    done:     { fill: 'rgba(16,185,129,0.10)',  stroke: '#10B981',  text: '#A7F3D0' },
    ready:    { fill: 'var(--raised)',           stroke: '#475569',  text: '#94A3B8' },
    backlog:  { fill: 'transparent',             stroke: '#334155',  text: '#64748B' },
  };

  const Node = ({ n, w = 130, h = 38, big }) => {
    const s = stateColor[n.state];
    return (
      <g style={{ cursor:'pointer' }} onClick={() => onPickTask && n.id.startsWith('TASK') && onPickTask(n.id)}>
        <rect x={n.x - w/2} y={n.y - h/2} width={w} height={h} rx={5}
          fill={s.fill} stroke={s.stroke} strokeWidth={n.state==='active' ? 1.6 : 1}
          style={n.state === 'active' ? { filter: 'drop-shadow(0 0 8px rgba(96,165,250,0.5))' } : {}}/>
        <text x={n.x} y={n.y - 3} textAnchor="middle" fill="#8A95A8"
          style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{n.id}</text>
        <text x={n.x} y={n.y + 10} textAnchor="middle" fill={s.text}
          style={{ fontSize: big ? 12 : 11, fontWeight: big ? 600 : 500 }}>{n.label}</text>
      </g>
    );
  };

  const linkColor = (childState, parentState) => {
    if (childState === 'active') return '#60A5FA';
    if (childState === 'done') return '#10B981';
    if (childState === 'review') return '#8B5CF6';
    if (childState === 'backlog') return '#334155';
    return '#475569';
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: 16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
        <div className="h-eyebrow">Dependency tree</div>
        <div style={{ display:'flex', gap: 10, fontSize: 11, color: 'var(--text-dim)' }}>
          {[
            { l:'active', c:'#60A5FA' },
            { l:'in progress', c:'#3B82F6' },
            { l:'in review', c:'#8B5CF6' },
            { l:'done', c:'#10B981' },
            { l:'ready', c:'#475569' },
            { l:'backlog', c:'#334155' },
          ].map(s => (
            <span key={s.l} style={{ display:'flex', alignItems:'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, border: '1.5px solid '+s.c, borderRadius: 2 }}/> {s.l}
            </span>
          ))}
        </div>
      </div>
      <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
        <defs>
          <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#475569"/>
          </marker>
        </defs>
        {/* epic → subepic */}
        {subepics.map((se, i) => (
          <path key={i} d={`M${epic.x},${epic.y+19} C${epic.x},${epic.y+50} ${se.x},${se.y-30} ${se.x},${se.y-19}`}
            stroke="#3B82F6" strokeWidth="1.2" fill="none" opacity="0.6"/>
        ))}
        {/* subepic → task */}
        {tasks.map((t, i) => {
          const se = subepics[t.parent];
          const c = linkColor(t.state, se.state);
          return (
            <path key={i} d={`M${se.x},${se.y+19} C${se.x},${se.y+45} ${t.x},${t.y-35} ${t.x},${t.y-19}`}
              stroke={c} strokeWidth={t.state==='active' ? 1.6 : 1} fill="none" opacity={t.state==='backlog' ? 0.4 : 0.7}/>
          );
        })}
        {/* nodes */}
        <Node n={epic} w={260} h={38} big/>
        {subepics.map((se, i) => <Node key={i} n={se} w={170} h={38} big/>)}
        {tasks.map((t, i) => <Node key={i} n={t} w={120} h={38}/>)}
      </svg>
    </div>
  );
};

window.KanbanBoard = KanbanBoard;

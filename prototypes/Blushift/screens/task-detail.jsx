/* global React, Icon, Avatar, Btn, FIXTURES, Pill */
const { useState: uS_td } = React;

const TaskDetailPanel = ({ taskId, onClose, navigate, projectId }) => {
  const [tab, setTab] = uS_td('Brief');
  const tabs = ['Brief', 'Handoff', 'Tests', 'Console', 'Audit'];
  const tb = FIXTURES.taskBrief;

  return (
    <div className="detail-panel panel-enter">
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot amber"/>
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{taskId || tb.id}</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>— {tb.title}</span>
          </div>
          <button className="btn ghost sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span className="chip">Engineer</span>
          <span className="chip amber">retry 1/3</span>
          <span className="chip">47 min</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-mute)' }}>TASK-019 → <span className="mono">TASK-024</span> → TASK-025</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)', padding: '0 16px' }}>
        {tabs.map(t => (
          <div key={t} className={`subtab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'Brief' && <BriefTab tb={tb} navigate={navigate}/>}
        {tab === 'Handoff' && <HandoffTab tb={tb}/>}
        {tab === 'Tests' && <TestsTab/>}
        {tab === 'Console' && <ConsoleTab/>}
        {tab === 'Audit' && <AuditMiniTab/>}
      </div>
    </div>
  );
};

const yamlHighlight = (s) => {
  // simple line-by-line tokenizer
  return s.split('\n').map((line, i) => {
    const m = line.match(/^(\s*)(#.*)$/);
    if (m) return <div key={i}><span>{m[1]}</span><span className="tk-cm">{m[2]}</span></div>;
    const m2 = line.match(/^(\s*-\s*)(.*)$/);
    if (m2) {
      const v = m2[2];
      const m3 = v.match(/^(.*?)(\s*#.*)$/);
      if (m3) {
        return <div key={i}><span className="tk-pun">{m2[1]}</span><span className="tk-str">{m3[1]}</span><span className="tk-cm">{m3[2]}</span></div>;
      }
      return <div key={i}><span className="tk-pun">{m2[1]}</span><span className="tk-str">{v}</span></div>;
    }
    const m4 = line.match(/^(\s*)([\w_.]+):(\s*)(.*)$/);
    if (m4) {
      const v = m4[4];
      let valEl;
      if (/^\d/.test(v)) valEl = <span className="tk-num">{v}</span>;
      else if (v) valEl = <span className="tk-str">{v}</span>;
      else valEl = '';
      return <div key={i}>{m4[1]}<span className="tk-key">{m4[2]}</span><span className="tk-pun">:</span>{m4[3]}{valEl}</div>;
    }
    return <div key={i}>{line || '\u00a0'}</div>;
  });
};

const BriefTab = ({ tb, navigate }) => (
  <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
    <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
      <span className="chip">acceptance: 5</span>
      <span className="chip blue">design_tokens: 6</span>
      <span className="chip">pixel_constraints</span>
      <span className="chip red">forbidden_inferences: 3</span>
      <span className="chip">required_diagrams: 1</span>
    </div>
    <pre className="mono" style={{
      margin: 0, padding: 14,
      background: '#08101A',
      border: '1px solid var(--line)',
      borderRadius: 5,
      fontSize: 11.5,
      lineHeight: 1.6,
      overflow: 'auto',
      maxHeight: 320,
      whiteSpace: 'pre',
    }}>
      {yamlHighlight(tb.yaml)}
    </pre>

    <div className="h-eyebrow">Form state machine (mermaid)</div>
    <div style={{ background: '#08101A', border: '1px solid var(--line)', borderRadius: 5, padding: 16 }}>
      <svg width="100%" height="120" viewBox="0 0 480 120">
        {[
          { x: 40,  y: 60, l: 'idle' },
          { x: 130, y: 60, l: 'validating' },
          { x: 230, y: 60, l: 'submitting' },
          { x: 340, y: 30, l: 'error' },
          { x: 340, y: 90, l: 'success' },
        ].map((n,i) => (
          <g key={i}>
            <rect x={n.x-32} y={n.y-14} width="64" height="28" rx="14" fill="var(--raised)" stroke="#3B82F6"/>
            <text x={n.x} y={n.y+4} textAnchor="middle" fontFamily="var(--mono)" fontSize="11" fill="#BFDBFE">{n.l}</text>
          </g>
        ))}
        {[
          ['M72 60 L98 60','#60A5FA'],
          ['M162 60 L198 60','#60A5FA'],
          ['M262 56 Q300 30 308 30','#EF4444'],
          ['M262 64 Q300 90 308 90','#10B981'],
          ['M340 44 Q360 60 340 76','#94A3B8'],
        ].map((p,i) => (
          <path key={i} d={p[0]} stroke={p[1]} strokeWidth="1.4" fill="none" markerEnd="url(#mh)"/>
        ))}
        <defs><marker id="mh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="#94A3B8"/></marker></defs>
      </svg>
    </div>

    <div className="h-eyebrow">Provenance</div>
    <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
      {[
        { i: 'doc', l: 'Original feedback line', sub: 'feedback/2026-04-22-checkout.md:L42' },
        { i: 'shield-check', l: 'Council finding C-2026-04-31', sub: 'consensus reached • 4/4 agents agreed' },
        { i: 'commit', l: 'Decision-log row D-070', sub: 'authored by Architect agent' },
        { i: 'sparkle', l: 'Linked Polaris proposal', sub: 'P-2026-05-08-014 — Add font preconnect' },
      ].map((it,i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns: '20px 1fr auto', gap:10, padding: '8px 10px', background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 5, cursor:'pointer' }}>
          <Icon name={it.i} size={14} style={{ color: 'var(--text-mute)' }}/>
          <div>
            <div style={{ fontSize: 12 }}>{it.l}</div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-mute)' }}>{it.sub}</div>
          </div>
          <Icon name="arrow-right" size={12} style={{ color: 'var(--text-mute)', alignSelf:'center' }}/>
        </div>
      ))}
    </div>
  </div>
);

const HandoffTab = ({ tb }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
    <div>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Natural-language brief</div>
      <div style={{ padding: 12, background: 'var(--raised)', border: '1px solid var(--line)', borderRadius: 5, fontSize: 12.5, lineHeight: 1.55 }}>
        Build the checkout summary page so customers see a clean, locale-aware order overview before completing payment. The page lives at <span className="mono" style={{ color: '#BFDBFE' }}>/checkout/summary</span> and consumes the BFF endpoints already exposed by the cart service.
        <br/><br/>
        It must show line items, taxes, totals, and an estimated delivery window. A promo-code field with live (debounced) validation is required. Persist scroll position across hydration.
        <br/><br/>
        Use only design tokens listed in DESIGN.md — no inferred values. Do not auto-submit on Enter in the promo field; surface errors inline.
      </div>
    </div>
    <div>
      <div className="h-eyebrow" style={{ marginBottom: 6 }}>Typed YAML</div>
      <pre className="mono" style={{ margin: 0, padding: 12, background: '#08101A', border: '1px solid var(--line)', borderRadius: 5, fontSize: 11, lineHeight: 1.55, overflow:'auto', maxHeight: 460 }}>
        {yamlHighlight(tb.yaml)}
      </pre>
    </div>
  </div>
);

const TestsTab = () => {
  const [filter, setFilter] = uS_td('all');
  const states = [
    { l: 'default',  s: 'pass' },
    { l: 'hover',    s: 'pass' },
    { l: 'focus',    s: 'pass' },
    { l: 'active',   s: 'pass' },
    { l: 'disabled', s: 'pass' },
    { l: 'loading',  s: 'pass' },
    { l: 'empty',    s: 'pass' },
    { l: 'error',    s: 'fail' },
  ];
  const tones = ['#1E3A8A', '#0E7490', '#7C3AED', '#1F2937', '#0F172A', '#111827', '#0E1420', '#7F1D1D'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
      <div className="surface" style={{ padding: 12 }}>
        <div className="h-eyebrow" style={{ marginBottom: 10 }}>F25 visual behaviour capture</div>
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {states.map((st, i) => (
            <div key={i} style={{
              border: '1px solid ' + (st.s === 'fail' ? 'var(--red)' : 'var(--line)'),
              borderRadius: 5, overflow: 'hidden',
              boxShadow: st.s === 'fail' ? '0 0 0 1px rgba(239,68,68,0.4) inset' : 'none',
            }}>
              <div style={{ aspectRatio: '16/10', background: `linear-gradient(135deg, ${tones[i]}, #050810)`, position: 'relative' }}>
                <div style={{ position:'absolute', top: 4, right: 4 }}>
                  <span className={`dot ${st.s === 'pass' ? 'green' : 'red'}`}/>
                </div>
                {/* fake checkout sketch */}
                <div style={{ position:'absolute', top: 10, left: 8, right: 28, height: 2, background:'rgba(255,255,255,0.4)' }}/>
                <div style={{ position:'absolute', top: 18, left: 8, width: 60, height: 1.5, background:'rgba(255,255,255,0.25)' }}/>
                <div style={{ position:'absolute', bottom: 10, left: 8, right: 8, height: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 1 }}/>
              </div>
              <div style={{ padding: '6px 8px', fontSize: 10.5, color: 'var(--text-dim)', display:'flex', justifyContent:'space-between' }}>
                <span>{st.l}</span>
                <span style={{ color: st.s === 'pass' ? 'var(--green)' : 'var(--red)' }} className="mono">{st.s.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface" style={{ padding: 12 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
          <div className="h-eyebrow">Browser console output</div>
          <div style={{ display:'flex', gap: 4 }}>
            {['all','info','warning','error'].map(f => (
              <button key={f} className={`tab ${filter === f ? 'active' : ''}`} style={{ height: 22, fontSize: 11, padding: '0 8px' }} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, padding: 10, background: '#08101A', border: '1px solid var(--line)', borderRadius: 5 }}>
          {[
            { l:'info', t:'14:42:01', m:'Hydration complete (612ms)' },
            { l:'info', t:'14:42:02', m:'BFF /shipping → 200 (118ms)' },
            { l:'warning', t:'14:42:02', m:'No Cache-Control on /api/portfolio' },
            { l:'info', t:'14:42:03', m:'Promo validator initialized' },
            { l:'error', t:'14:42:14', m:'AssertionError: font Fraunces not loaded within 300ms (got 612ms)' },
            { l:'info', t:'14:42:14', m:'F25 capture saved → traces/TASK-024-3.zip' },
          ].filter(x => filter === 'all' || x.l === filter).map((x, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns: '60px 60px 1fr', gap: 8 }}>
              <span style={{ color: 'var(--text-mute)' }}>{x.t}</span>
              <span style={{ color: x.l === 'error' ? 'var(--red)' : x.l === 'warning' ? 'var(--amber)' : 'var(--blue-bright)' }}>{x.l}</span>
              <span style={{ color: x.l === 'error' ? '#FCA5A5' : 'var(--text)' }}>{x.m}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ConsoleTab = () => {
  const entries = [
    { t: '15:42:18', a: 'Engineer', tool: 'Edit',  s: 'src/components/Bubble.tsx — added preconnect link' },
    { t: '15:42:01', a: 'Engineer', tool: 'Read',  s: 'src/components/Cart.tsx (122 LOC)' },
    { t: '15:41:30', a: 'Engineer', tool: 'Bash',  s: 'pnpm test --filter checkout (exit 0, 12.4s)' },
    { t: '15:39:02', a: 'Engineer', tool: 'Edit',  s: 'src/lib/intl.ts — currency formatter' },
    { t: '15:38:44', a: 'Engineer', tool: 'Read',  s: 'DESIGN.md (token references)' },
    { t: '15:37:11', a: 'Engineer', tool: 'Write', s: 'src/components/Promo.tsx (new file)' },
    { t: '15:34:02', a: 'Engineer', tool: 'Edit',  s: 'src/components/Order.tsx — line items' },
    { t: '15:32:18', a: 'Sandbox',  tool: 'Block', s: 'BLOCKED: write to ~/.kube/config (protected path)', flag: 'red' },
    { t: '15:30:55', a: 'Engineer', tool: 'Read',  s: 'progress.json' },
  ];
  const agentTone = { Engineer: 'var(--blue-bright)', QA: '#22D3EE', Sandbox: 'var(--red)', Architect: 'var(--purple)' };
  return (
    <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.55, background: '#08101A', border: '1px solid var(--line)', borderRadius: 5, padding: 12 }}>
      {entries.map((e, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns: '76px 76px 60px 1fr 14px', gap: 8, padding: '4px 0', borderBottom: i < entries.length-1 ? '1px solid var(--line-soft)' : 'none' }}>
          <span style={{ color: 'var(--text-mute)' }}>{e.t}</span>
          <span style={{ color: agentTone[e.a] || 'var(--text-dim)' }}>{e.a}</span>
          <span style={{ color: 'var(--text-dim)' }}>{e.tool}</span>
          <span style={{ color: e.flag === 'red' ? '#FCA5A5' : 'var(--text)' }}>{e.s}</span>
          <Icon name="chevron-right" size={11} style={{ color: 'var(--text-faint)', alignSelf: 'center' }}/>
        </div>
      ))}
      <div style={{ display:'flex', alignItems:'center', gap: 8, marginTop: 10, color: 'var(--text-mute)' }}>
        <span className="dot blue blink"/>
        <span>streaming</span>
        <span className="blink">▍</span>
      </div>
    </div>
  );
};

const AuditMiniTab = () => {
  const sub = FIXTURES.audit.entries.slice(0, 8);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
      {sub.map(e => (
        <div key={e.n} className="mono" style={{ display:'grid', gridTemplateColumns: '50px 130px 50px 1fr', gap: 8, padding: '6px 8px', background: e.flag === 'red' ? 'rgba(239,68,68,0.05)' : 'var(--raised)', border: '1px solid ' + (e.flag === 'red' ? 'rgba(239,68,68,0.3)' : 'var(--line)'), borderRadius: 4, fontSize: 11 }}>
          <span style={{ color: 'var(--text-mute)' }}>#{e.n}</span>
          <span style={{ color: 'var(--text-mute)' }}>{e.t.split('T')[1].replace('Z','')}</span>
          <span style={{ color: e.flag === 'red' ? 'var(--red)' : 'var(--blue-bright)' }}>{e.op}</span>
          <span style={{ color: e.flag === 'red' ? '#FCA5A5' : 'var(--text)' }}>{e.target}</span>
        </div>
      ))}
    </div>
  );
};

window.TaskDetailPanel = TaskDetailPanel;

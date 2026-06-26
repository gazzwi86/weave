/* global React, Icon, Btn, Avatar, Bar, FIXTURES */
const { useState: uS_fin } = React;

const FINOPS_BUDGETS = [
  { ws:'Customer Portal',         used: 4847,  cap: 8000,  trend:[3,4,4,5,4,5,6], spike:false, runway:'12 days' },
  { ws:'Fraud & Claims',          used: 7912,  cap: 9000,  trend:[5,7,8,9,11,10,12], spike:true,  runway:'4 days'  },
  { ws:'Lending Data Platform',   used: 6403,  cap: 12000, trend:[5,6,7,6,7,8,9],  spike:false, runway:'18 days' },
  { ws:'Policy & Underwriting',   used: 1284,  cap: 4000,  trend:[1,2,2,2,2,3,2],  spike:false, runway:'27 days' },
  { ws:'Platform Foundations',    used: 11402, cap: 15000, trend:[8,9,10,11,11,12,11], spike:false, runway:'9 days' },
  { ws:'Data & ML',               used: 3194,  cap: 6500,  trend:[3,4,4,5,5,4,5],  spike:false, runway:'14 days' },
];

const COST_BY_AGENT = [
  { agent:'Engineer agent',  pct: 42, cost: 14702, trend:'+8%' },
  { agent:'Spec Agent',      pct: 18, cost:  6304, trend:'+12%' },
  { agent:'Critic',          pct: 12, cost:  4203, trend:'+3%' },
  { agent:'Tech-Writer',     pct: 9,  cost:  3151, trend:'-2%' },
  { agent:'Reviewer',        pct: 8,  cost:  2801, trend:'+5%' },
  { agent:'Architect',       pct: 5,  cost:  1750, trend:'+1%' },
  { agent:'Polaris',         pct: 4,  cost:  1401, trend:'+18%' },
  { agent:'Other',           pct: 2,  cost:   700, trend:'-' },
];

const COST_BY_MODEL = [
  { model:'claude-sonnet-4-5', pct: 58, cost: 20300, calls: '1.4M' },
  { model:'claude-haiku-4-5',  pct: 22, cost:  7700, calls: '4.2M' },
  { model:'claude-opus-4-1',   pct: 14, cost:  4900, calls: '0.18M' },
  { model:'embedding',         pct:  4, cost:  1400, calls: '12M' },
  { model:'other',             pct:  2, cost:   712, calls: '0.05M' },
];

const ANOMALIES = [
  { kind:'spike',     msg:'fraud-uplift workspace burned 38% of monthly cap in 2 days',   action:'Investigate' },
  { kind:'inefficiency', msg:'Spec Agent retried 9× on csp-v2 promo-code spec — cost $217 over baseline', action:'Polaris proposal exists' },
  { kind:'inefficiency', msg:'Critic re-runs on previously-approved tasks — $43/day waste', action:'Polaris proposal exists' },
  { kind:'savings',   msg:'Routing trivial wiki-edits to Haiku would save ~$220/mo at parity quality', action:'Apply (PL-2026-05-03-014)' },
];

const FinOpsScreen = ({ navigate }) => {
  const [period, setPeriod] = uS_fin('month');
  const totalUsed = FINOPS_BUDGETS.reduce((s,b) => s + b.used, 0);
  const totalCap = FINOPS_BUDGETS.reduce((s,b) => s + b.cap, 0);

  return (
    <div className="page-enter" style={{ padding:'20px 24px', maxWidth: 1480, margin:'0 auto' }}>
      <window.PageHeader
        eyebrow="Cost · Budgets · Efficiency"
        icon="graph"
        title="FinOps"
        subtitle={`$${totalUsed.toLocaleString()} of $${totalCap.toLocaleString()} this month — ${Math.round(totalUsed/totalCap*100)}% utilised`}
        role="The economic accounting of running an agentic engineering org. Tracks cost by workspace, project, agent, model, and tool — with caps and burn alerts."
        purpose="Set budgets, watch burn rate, drill into anomalies, and approve cost-saving proposals routed from Polaris."
        contributes="Without this, agent costs are invisible until the bill arrives. With it, every workspace owns its number, every spike has an explanation."
        actions={<>
          <select className="inp" style={{ height: 30, fontSize: 12 }} value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="day">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
          </select>
          <Btn icon="download" variant="ghost" size="sm">Export</Btn>
          <Btn icon="gear" onClick={() => navigate('/settings')}>Caps & alerts</Btn>
        </>}
      />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <FinKPI label="Spent this month"    value={`$${totalUsed.toLocaleString()}`} sub="↑ 14% vs last month" tone="amber"/>
        <FinKPI label="Projected end-of-month" value={`$${(totalUsed * 1.42).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`} sub={`${Math.round(totalUsed/totalCap*100)}% of cap`}/>
        <FinKPI label="Tokens (in / out)"    value="412M / 88M" sub="2.1× last month"/>
        <FinKPI label="Cost per project"    value="$3,127 avg" sub="6 active projects"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Workspace burn</div>
          <div style={{ display:'flex', flexDirection:'column', gap: 12 }}>
            {FINOPS_BUDGETS.map(b => <BurnRow key={b.ws} b={b}/>)}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Anomalies & savings</div>
          <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
            {ANOMALIES.map((a,i) => (
              <div key={i} style={{ padding: 10, border:'1px solid var(--line-soft)', borderRadius: 6, borderLeft: `2px solid ${a.kind==='spike'?'#EF4444':a.kind==='inefficiency'?'#F59E0B':'#10B981'}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: a.kind==='spike'?'#FCA5A5':a.kind==='inefficiency'?'#FCD34D':'#A7F3D0', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom: 4 }}>
                  {a.kind === 'spike' ? '↑ Cost spike' : a.kind === 'inefficiency' ? '⚠ Inefficiency' : '✓ Savings opportunity'}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>{a.msg}</div>
                <span style={{ fontSize: 11, color:'var(--blue-bright)', cursor:'pointer' }}>{a.action} →</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Cost by agent</div>
          <CostStack rows={COST_BY_AGENT} keyName="agent"/>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="h-eyebrow" style={{ marginBottom: 12 }}>Cost by model</div>
          <CostStack rows={COST_BY_MODEL} keyName="model"/>
        </div>
      </div>
    </div>
  );
};

const FinKPI = ({ label, value, sub, tone }) => (
  <div className="card" style={{ padding: 14 }}>
    <div className="h-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600, color: tone==='amber'?'var(--amber)':tone==='green'?'var(--green)':'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color:'var(--text-dim)', marginTop: 4 }}>{sub}</div>}
  </div>
);

const BurnRow = ({ b }) => {
  const pct = b.used / b.cap;
  const tone = pct > 0.85 ? '#EF4444' : pct > 0.6 ? '#F59E0B' : '#10B981';
  const max = Math.max(...b.trend);
  return (
    <div style={{ display:'grid', gridTemplateColumns:'180px 1fr 80px 100px 80px', gap: 12, alignItems:'center' }}>
      <div style={{ fontSize: 12.5 }}>
        {b.ws}
        {b.spike && <span style={{ marginLeft: 6, fontSize: 9.5, color:'#FCA5A5', background:'var(--red-bg)', padding:'1px 5px', borderRadius: 3 }}>SPIKE</span>}
      </div>
      <div>
        <div style={{ height: 8, background:'var(--raised)', borderRadius: 4, overflow:'hidden', marginBottom: 4 }}>
          <div style={{ width: `${pct*100}%`, height:'100%', background: tone }}/>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>${b.used.toLocaleString()} / ${b.cap.toLocaleString()}</div>
      </div>
      <span className="mono" style={{ fontSize: 12, color: tone }}>{(pct*100).toFixed(0)}%</span>
      <span style={{ fontSize: 11, color:'var(--text-dim)' }}>runway {b.runway}</span>
      <svg width="60" height="22">
        {b.trend.map((v,i) => {
          const h = (v / max) * 18;
          return <rect key={i} x={i*9} y={20 - h} width="6.5" height={h} rx={1} fill={tone} opacity={0.6 + (v/max)*0.4}/>;
        })}
      </svg>
    </div>
  );
};

const CostStack = ({ rows, keyName }) => {
  const colors = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#06B6D4','#EF4444','#94A3B8'];
  return (
    <div>
      <div style={{ display:'flex', height: 14, borderRadius: 4, overflow:'hidden', marginBottom: 14 }}>
        {rows.map((r, i) => (
          <div key={i} title={`${r[keyName]} · ${r.pct}%`} style={{ width: `${r.pct}%`, background: colors[i % colors.length] }}/>
        ))}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
        {rows.map((r,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'12px 1fr 60px 80px 60px', gap: 10, alignItems:'center', fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length] }}/>
            <span style={{ color:'var(--text)' }}>{r[keyName]}</span>
            <span className="mono" style={{ color:'var(--text-mute)' }}>{r.pct}%</span>
            <span className="mono">${r.cost.toLocaleString()}</span>
            <span className="mono" style={{ color: r.trend && r.trend.startsWith('+') ? 'var(--amber)' : r.trend && r.trend.startsWith('-') ? 'var(--green)' : 'var(--text-mute)', fontSize: 11 }}>{r.calls || r.trend}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

window.FinOpsScreen = FinOpsScreen;

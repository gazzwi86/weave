/* global React, Icon, Btn, Avatar */
const { useState: uS_se } = React;

const SettingsScreen = ({ navigate }) => {
  const [tab, setTab] = uS_se('agents');
  const tabs = [
    { id:'agents',     l:'Agents' },
    { id:'permissions', l:'Permissions & policies' },
    { id:'integrations', l:'Integrations' },
    { id:'audit',      l:'Audit & retention' },
    { id:'account',    l:'Account' },
  ];

  return (
    <div className="page-enter" style={{ display:'grid', gridTemplateColumns: '220px 1fr', height:'calc(100vh - 44px)' }}>
      <div style={{ borderRight: '1px solid var(--line)', padding: '20px 12px', background:'var(--surface)' }}>
        <div className="h-eyebrow" style={{ padding: '0 8px 10px' }}>Settings</div>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '7px 10px', borderRadius: 4, fontSize: 12.5,
              color: tab === t.id ? 'var(--blue-bright)' : 'var(--text-dim)',
              background: tab === t.id ? 'rgba(59,130,246,0.08)' : 'transparent',
              borderLeft: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
              cursor:'pointer', marginBottom: 2,
            }}>{t.l}</div>
        ))}
      </div>

      <div style={{ overflow:'auto', padding: '24px 32px', maxWidth: 980 }}>
        {tab === 'agents' && <AgentsTab/>}
        {tab === 'permissions' && <PermsTab/>}
        {tab === 'integrations' && <IntegrationsTab/>}
        {tab === 'audit' && <RetentionTab/>}
        {tab === 'account' && <AccountTab/>}
      </div>
    </div>
  );
};

const AgentsTab = () => {
  const agents = [
    { id:'eng',   n:'Engineer',     d:'Plans, edits, tests, ships code', model:'claude-sonnet-4.5', t:'4.7M tokens this week', tools:['Read','Edit','Bash','Write','GH'], on:true },
    { id:'tw',    n:'Tech Writer',  d:'Maintains the living wiki',        model:'claude-haiku-4.5',  t:'820K tokens this week', tools:['Read','Edit','Search'], on:true },
    { id:'spec',  n:'Spec Agent',   d:'Snappy requests → briefs/PRDs',    model:'claude-sonnet-4.5', t:'2.1M tokens this week', tools:['Read','Search','Plan'], on:true },
    { id:'crit',  n:'Critic',       d:'Reviews proposals, flags risks',    model:'claude-sonnet-4.5', t:'1.4M tokens this week', tools:['Read','Search'], on:true },
    { id:'pol',   n:'Polaris',      d:'Watches code, generates ideas',     model:'claude-haiku-4.5',  t:'3.2M tokens this week', tools:['Read','Search'], on:false },
  ];
  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Agents</h1>
      <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 20 }}>5 active agents · model and tool access configured per agent.</div>
      <div className="card" style={{ padding: 0, overflow:'hidden' }}>
        {agents.map((a,i) => (
          <div key={a.id} style={{ padding: '14px 16px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'1fr 200px 200px 80px', gap: 14, alignItems:'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{a.n}</div>
              <div style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{a.d}</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, color:'var(--blue-bright)' }}>{a.model}</div>
              <div style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{a.t}</div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
              {a.tools.map(t => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
            </div>
            <div style={{ textAlign:'right' }}>
              <Toggle on={a.on}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PermsTab = () => (
  <div>
    <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Permissions & policies</h1>
    <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 20 }}>Sandbox, scrubber and review gates for agent actions.</div>

    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Sandbox</div>
      {[
        { l:'Block writes outside repo root', on: true },
        { l:'Block network egress to non-allowlisted domains', on: true },
        { l:'Block destructive bash (rm -rf, mkfs, dd)', on: true },
        { l:'Allow git push to main', on: false, danger: true },
      ].map(p => (
        <div key={p.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '8px 0', borderTop:'1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 13, color: p.danger ? 'var(--red-bright)' : 'var(--text)' }}>{p.l}</span>
          <Toggle on={p.on}/>
        </div>
      ))}
    </div>

    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Scrubber rules</div>
      <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 8 }}>Outbound prompts are scanned for these patterns before being sent to model providers.</div>
      <pre className="mono" style={{ background:'#08101A', border:'1px solid var(--line)', borderRadius: 5, padding: 12, fontSize: 11.5, lineHeight: 1.6, margin:0 }}>
{`PII:    /\\b\\d{3}-\\d{2}-\\d{4}\\b/        → [REDACTED:SSN]
SECRET: /sk_live_[a-zA-Z0-9]+/         → [REDACTED:API_KEY]
PII:    /\\b[A-Z]{2}\\d{2}\\s?\\d{4}…/  → [REDACTED:UK_SORT]
INTERNAL: /confidential.northwind.io/  → block
CUSTOM: 11 patterns                    → see editor →`}
      </pre>
    </div>

    <div className="card" style={{ padding: 16 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Review gates</div>
      {[
        { l:'Code change to /infra/ requires human approval', on: true },
        { l:'Auto-merge PRs with green CI + 1 review', on: false },
        { l:'Polaris idea → project requires HITL', on: true },
      ].map(g => (
        <div key={g.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '8px 0', borderTop:'1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 13 }}>{g.l}</span>
          <Toggle on={g.on}/>
        </div>
      ))}
    </div>
  </div>
);

const IntegrationsTab = () => {
  const list = [
    { n:'GitHub',       s:'connected', d:'2 orgs · 47 repos' },
    { n:'Linear',       s:'connected', d:'NW workspace' },
    { n:'Slack',        s:'connected', d:'#claims, #lending, #infra' },
    { n:'Snowflake',    s:'connected', d:'NORTHWIND_PROD' },
    { n:'Jira',         s:'available' },
    { n:'PagerDuty',    s:'available' },
    { n:'Datadog',      s:'connected', d:'metrics + logs' },
    { n:'AWS IAM',      s:'connected', d:'eu-west-1, eu-west-2' },
  ];
  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Integrations</h1>
      <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 20 }}>Tools Blushift can read from and write to.</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10 }}>
        {list.map(i => (
          <div key={i.n} className="card" style={{ padding: 14, display:'flex', alignItems:'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background:'var(--raised)', border:'1px solid var(--line-strong)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 13, fontWeight: 600 }}>{i.n[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{i.n}</div>
              <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{i.d || '—'}</div>
            </div>
            {i.s === 'connected' ? <span className="chip green">connected</span> : <Btn size="sm">Connect</Btn>}
          </div>
        ))}
      </div>
    </div>
  );
};

const RetentionTab = () => (
  <div>
    <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Audit & retention</h1>
    <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 20 }}>Data retention windows and audit chain settings.</div>

    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Retention windows</div>
      {[
        { l:'Audit chain entries', v:'forever' },
        { l:'Agent transcripts', v:'365 days' },
        { l:'Snappy request drafts', v:'90 days' },
        { l:'Polaris ideas (rejected)', v:'30 days' },
      ].map(r => (
        <div key={r.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '8px 0', borderTop:'1px solid var(--line-soft)' }}>
          <span style={{ fontSize: 13 }}>{r.l}</span>
          <select className="inp" style={{ width: 140, height: 28 }} defaultValue={r.v}><option>{r.v}</option></select>
        </div>
      ))}
    </div>

    <div className="card" style={{ padding: 16 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Export</div>
      <div style={{ display:'flex', gap: 8 }}>
        <Btn icon="download">Export audit chain (NDJSON)</Btn>
        <Btn icon="download">Export decisions log</Btn>
      </div>
    </div>
  </div>
);

const AccountTab = () => (
  <div>
    <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600 }}>Account</h1>
    <div style={{ fontSize: 12.5, color:'var(--text-dim)', marginBottom: 20 }}>Org & profile settings.</div>
    <div className="card" style={{ padding: 16, display:'flex', alignItems:'center', gap: 14, marginBottom: 12 }}>
      <Avatar name="Sarah Chen" size={48}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Sarah Chen</div>
        <div style={{ fontSize: 12, color:'var(--text-dim)' }}>sarah.chen@northwind.io · Engineering</div>
      </div>
      <Btn>Edit profile</Btn>
    </div>
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="h-eyebrow" style={{ marginBottom: 10 }}>Organization</div>
      <div style={{ fontSize: 13 }}>Northwind Mutual</div>
      <div style={{ fontSize: 11, color:'var(--text-mute)' }}>Plan: Enterprise · seats 24/40 used</div>
    </div>
  </div>
);

const Toggle = ({ on }) => (
  <span style={{
    width: 30, height: 18, borderRadius: 10,
    background: on ? 'var(--blue)' : 'var(--line-strong)',
    position:'relative',
    display:'inline-block',
    transition:'background .15s',
  }}>
    <span style={{
      position:'absolute',
      width: 14, height: 14,
      borderRadius:'50%',
      background:'#fff',
      top: 2, left: on ? 14 : 2,
      transition:'left .15s',
    }}/>
  </span>
);

window.SettingsScreen = SettingsScreen;

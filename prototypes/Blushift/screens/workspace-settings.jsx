/* global React, Icon, Btn, Avatar, Bar, Pill, FIXTURES */
const { useState: uS_wsx } = React;

// ─────────────────────────────────────────────────────────────────────────
// WORKSPACE SETTINGS — hi-fi.
// Tabs: Budget · Policies · Members · Integrations · Environments · Data · Notifications · Cascade
// Premise: every setting either INHERITS from Company → Domain, is TIGHTENED here,
// or is set fresh. The same control language is used everywhere so users learn it once.
// ─────────────────────────────────────────────────────────────────────────

const WS_SETTINGS_TABS = [
  { id:'budget',         label:'Budget & cost' },
  { id:'policies',       label:'Policies' },
  { id:'members',        label:'Members & roles' },
  { id:'integrations',   label:'Integrations' },
  { id:'environments',   label:'Environments' },
  { id:'data',           label:'Data classes' },
  { id:'notifications',  label:'Notifications' },
  { id:'cascade',        label:'Cascade' },
];

const WorkspaceSettings = ({ w, navigate }) => {
  const [tab, setTab] = uS_wsx('budget');

  return (
    <div>
      {/* page subhead bar */}
      <div className="card" style={{ padding:'12px 16px', marginBottom: 14, display:'flex', alignItems:'center', gap: 14 }}>
        <Icon name="shield-check" size={16} style={{ color:'var(--blue-bright)' }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Workspace settings — {w.name}</div>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)' }}>
            Inherits from <CrumbLink onClick={() => navigate('/organisation/company')}>Northwind Mutual</CrumbLink> → <CrumbLink onClick={() => navigate('/organisation/company/domains')}>{w.domain || 'Customer'} domain</CrumbLink>. Tighter values here always win; loosening requires Company-level approval.
          </div>
        </div>
        <span className="chip" style={{ fontSize: 10.5 }}>3 inheritance overrides</span>
        <span className="chip" style={{ fontSize: 10.5, color:'var(--amber)' }}>1 violation pending</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap: 18, alignItems:'flex-start' }}>
        {/* LEFT vertical tabs */}
        <div className="card" style={{ padding: 6, position:'sticky', top: 70 }}>
          {WS_SETTINGS_TABS.map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding:'8px 10px', borderRadius: 4, fontSize: 12.5, cursor:'pointer',
                background: tab===t.id ? 'var(--raised)' : 'transparent',
                color: tab===t.id ? 'var(--text)' : 'var(--text-dim)',
                fontWeight: tab===t.id ? 500 : 400,
                borderLeft: tab===t.id ? '2px solid var(--blue-bright)' : '2px solid transparent',
                marginBottom: 1,
              }}>
              {t.label}
            </div>
          ))}
        </div>

        {/* RIGHT panel */}
        <div>
          {tab === 'budget'        && <BudgetTab w={w}/>}
          {tab === 'policies'      && <PoliciesTab w={w}/>}
          {tab === 'members'       && <MembersTab w={w}/>}
          {tab === 'integrations'  && <IntegrationsTab w={w}/>}
          {tab === 'environments'  && <EnvironmentsTab w={w}/>}
          {tab === 'data'          && <DataClassesTab w={w}/>}
          {tab === 'notifications' && <NotificationsTab w={w}/>}
          {tab === 'cascade'       && <CascadeTab w={w} navigate={navigate}/>}
        </div>
      </div>
    </div>
  );
};

const CrumbLink = ({ onClick, children }) => (
  <span onClick={onClick} style={{ color:'var(--blue-bright)', cursor:'pointer' }} className="row-hover">{children}</span>
);

// ───────────────────── shared row primitives ─────────────────────

// Source pill — where this value comes from in the cascade.
const SourcePill = ({ src }) => {
  const map = {
    company:  { l:'Company',   c:'#94A3B8' },
    domain:   { l:'Domain',    c:'#A78BFA' },
    workspace:{ l:'This WS',   c:'#5B8DEF' },
    project:  { l:'Project',   c:'#10B981' },
  };
  const s = map[src] || map.workspace;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding:'1px 6px', borderRadius: 3,
      background:'var(--raised-strong)', color: s.c, textTransform:'uppercase', letterSpacing:'0.04em',
    }}>{s.l}</span>
  );
};

const SettingRow = ({ label, hint, src, control, ovrLocked, footer }) => (
  <div style={{ padding:'14px 0', borderTop:'1px solid var(--line-soft)' }}>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap: 24, alignItems:'flex-start' }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
          {src && <SourcePill src={src}/>}
          {ovrLocked && <span className="chip" style={{ fontSize: 10, color:'var(--amber)' }}>locked by domain</span>}
        </div>
        {hint && <div style={{ fontSize: 11.5, color:'var(--text-mute)', lineHeight: 1.5, maxWidth: 540 }}>{hint}</div>}
      </div>
      <div>{control}</div>
    </div>
    {footer && <div style={{ marginTop: 8, fontSize: 11, color:'var(--text-mute)' }}>{footer}</div>}
  </div>
);

const Section = ({ title, sub, children, action }) => (
  <div className="card" style={{ padding: '18px 22px', marginBottom: 14 }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 6 }}>
      <div>
        <h3 style={{ margin:0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
        {sub && <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>{sub}</div>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const Money = ({ value, suffix='/mo' }) => (
  <span><span className="mono" style={{ fontSize: 13 }}>${value.toLocaleString()}</span><span style={{ fontSize: 11, color:'var(--text-mute)' }}> {suffix}</span></span>
);

const Toggle = ({ on, label }) => (
  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
    <div style={{
      width: 32, height: 18, borderRadius: 10, position:'relative', cursor:'pointer',
      background: on ? 'var(--blue-bright)' : 'var(--raised-strong)', transition:'background 120ms',
    }}>
      <div style={{
        position:'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius:'50%',
        background:'#fff', transition:'left 120ms',
      }}/>
    </div>
    {label && <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{label}</span>}
  </div>
);

const Field = ({ value, suffix, w='80px' }) => (
  <div style={{ display:'inline-flex', alignItems:'center', gap: 6, padding:'6px 10px', background:'var(--raised)', border:'1px solid var(--line)', borderRadius: 4, width: w }}>
    <span className="mono" style={{ fontSize: 12, flex:1 }}>{value}</span>
    {suffix && <span style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{suffix}</span>}
  </div>
);

// ───────────────────── BUDGET ─────────────────────
const BudgetTab = ({ w }) => (
  <>
    <Section title="Spend caps" sub="Hard limits on agent spend per period. Hitting a cap pauses agents until reset or override.">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14, padding:'10px 0' }}>
        {[
          { l:'Monthly cap', v: 18000, used: 11240, src:'workspace' },
          { l:'Per-spec cap', v: 25, used: null, src:'workspace', suffix:'/spec' },
          { l:'Per-PR cap',   v: 8,  used: null, src:'company',   suffix:'/PR' },
        ].map((b, i) => (
          <div key={i} style={{ padding: 14, border:'1px solid var(--line)', borderRadius: 5, background:'var(--raised)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, color:'var(--text-mute)' }}>{b.l}</span>
              <SourcePill src={b.src}/>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing:'-0.01em' }}>${b.v.toLocaleString()}<span style={{ fontSize: 11, color:'var(--text-mute)', fontWeight: 400 }}> {b.suffix || '/mo'}</span></div>
            {b.used !== null && (
              <div style={{ marginTop: 8 }}>
                <Bar value={b.used} max={b.v}/>
                <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 4 }}>${b.used.toLocaleString()} used · 14d remaining</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>

    <Section title="Model class restrictions" sub="Agents may only invoke models in the allowed tier. Higher tiers require approval per request.">
      <SettingRow label="Default tier" src="domain"
        hint="The tier agents fall back to without explicit upgrade. Domain mandates 'standard' minimum."
        control={<select className="select-fake">
          <option>standard (Sonnet-class, $3 / Mtok)</option>
          <option>fast (Haiku-class)</option>
        </select>}/>
      <SettingRow label="Allow premium escalation" src="workspace"
        hint="Permit agents to step up to premium models when self-judged complexity exceeds threshold. Counts toward per-spec cap."
        control={<Toggle on={true} label="Allowed up to 20% of specs"/>}/>
      <SettingRow label="Block experimental tier" src="company"
        hint="Company-level: experimental models are blocked workspace-wide. You cannot loosen this."
        ovrLocked
        control={<Toggle on={false} label="Blocked"/>}/>
    </Section>

    <Section title="Alerts">
      <SettingRow label="Burn-rate alert" src="workspace"
        hint="Notify the workspace lead when projected spend at current burn would exceed 90% of cap before period end."
        control={<div style={{ display:'flex', gap: 8 }}><Toggle on={true}/><Field value="90" suffix="%" w="70px"/></div>}/>
      <SettingRow label="Per-task overage" src="workspace"
        hint="Per-task spend > N× the workspace median triggers a critic review before merge."
        control={<Field value="3.0" suffix="× median" w="100px"/>}/>
    </Section>
  </>
);

// ───────────────────── POLICIES ─────────────────────
const POLICIES = [
  {
    id:'POL-001', kind:'PII handling', src:'company', state:'enforced',
    title:'No untagged customer fields in logs',
    body:'Any field originating from a customer-bound table must be either explicitly tagged @public or wrapped in mask() before reaching log destinations. Spec Agent checks this against the data classification registry.',
    citedBy: 14, lastCited:'12m ago',
  },
  {
    id:'POL-002', kind:'Data residency', src:'company', state:'enforced',
    title:'EU customer data must remain in EU regions',
    body:'No service touching EU-classified data may write to or read from non-EU storage. Includes Snowflake regions, S3 buckets, message queues, and downstream caches.',
    citedBy: 22, lastCited:'2h ago',
  },
  {
    id:'POL-003', kind:'Cost cap', src:'workspace', state:'enforced',
    title:'Specs above $25 require human-in-loop approval',
    body:'Spec Agent estimates spec cost up-front; if estimate > $25, the spec gates on workspace-lead approval before generation continues.',
    citedBy: 7, lastCited:'1d ago',
  },
  {
    id:'POL-004', kind:'PII handling', src:'workspace', state:'advisory',
    title:'Prefer pseudonymous IDs over raw customer-id in cross-service events',
    body:'Use the customer hash (CHID) for cross-service correlation; only resolve to raw customer-id at service boundaries that have explicit need. Critic warns but does not block.',
    citedBy: 4, lastCited:'5h ago',
  },
  {
    id:'POL-005', kind:'Cost cap', src:'project', state:'enforced',
    title:'CSP-v2: per-PR cap $4 (lower than workspace)',
    body:'Project-level tightening — fraud-uplift project ran hot last quarter; we hold this project to half the workspace per-PR cap.',
    citedBy: 0, lastCited:'never',
  },
];

const WS_KIND_TONE = {
  'PII handling':    { c:'#A78BFA', bg:'rgba(167,139,250,0.15)' },
  'Data residency':  { c:'#34D399', bg:'rgba(52,211,153,0.15)' },
  'Cost cap':        { c:'#F59E0B', bg:'rgba(245,158,11,0.15)' },
};

const PoliciesTab = ({ w }) => {
  const [open, setOpen] = uS_wsx(POLICIES[0].id);
  return (
    <Section title="Active policies" sub="Rules the Spec Agent and Critic apply to every generated spec and every produced PR. Click a row to inspect."
      action={<Btn icon="plus" variant="primary" size="sm">New policy</Btn>}>
      <div style={{ marginTop: 4 }}>
        {POLICIES.map((p, i) => {
          const k = WS_KIND_TONE[p.kind] || { c:'#94A3B8', bg:'var(--raised)' };
          const isOpen = open === p.id;
          return (
            <div key={p.id} style={{ borderTop: i?'1px solid var(--line-soft)':'none' }}>
              <div className="row-hover" onClick={() => setOpen(isOpen ? null : p.id)}
                style={{ padding:'12px 4px', display:'grid', gridTemplateColumns:'18px 110px 1fr 80px 100px 14px', gap: 12, alignItems:'center', cursor:'pointer' }}>
                <Icon name="shield-check" size={13} style={{ color: p.state === 'enforced' ? '#10B981' : '#F59E0B' }}/>
                <span className="mono" style={{ fontSize: 11, color:'var(--text-mute)' }}>{p.id}</span>
                <div>
                  <div style={{ fontSize: 13 }}>{p.title}</div>
                  <div style={{ fontSize: 10.5, color:'var(--text-mute)', marginTop: 2 }}>{p.citedBy} citations · last {p.lastCited}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background: k.bg, color: k.c, justifySelf:'start', textTransform:'uppercase', letterSpacing:'0.04em' }}>{p.kind}</span>
                <SourcePill src={p.src}/>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} style={{ color:'var(--text-mute)' }}/>
              </div>
              {isOpen && (
                <div style={{ padding:'10px 16px 16px', background:'var(--raised)', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color:'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>{p.body}</div>
                  <div style={{ display:'flex', gap: 14, fontSize: 11, color:'var(--text-mute)', borderTop:'1px solid var(--line-soft)', paddingTop: 10 }}>
                    <span><strong style={{ color:'var(--text)' }}>{p.citedBy}</strong> agent citations · last {p.lastCited}</span>
                    <span>·</span>
                    <span>Authored by Maya Patel · 2026-04-12</span>
                    <span>·</span>
                    <span>v3 (last edited 9d ago)</span>
                    <div style={{ flex:1 }}/>
                    <Btn size="sm">Edit</Btn>
                    <Btn size="sm" variant="ghost">View violations (0)</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
};

// ───────────────────── MEMBERS ─────────────────────
const MEMBERS = [
  { name:'Sarah Chen',     role:'Workspace lead',     kind:'human', email:'sarah.chen@northwind', joined:'2024-03', perms:['admin','approve-spec','manage-budget'] },
  { name:'Alex Tomic',     role:'Architect',          kind:'human', email:'alex.tomic@northwind', joined:'2024-08', perms:['approve-spec','review'] },
  { name:'Maya Patel',     role:'Risk & compliance',  kind:'human', email:'maya.patel@northwind', joined:'2025-01', perms:['policy-author','approve-residency'] },
  { name:'Robin Lee',      role:'Engineer',           kind:'human', email:'robin.lee@northwind',  joined:'2025-06', perms:['review','submit-pr'] },
  { name:'Spec Agent',     role:'Spec author',        kind:'agent', email:'agent:spec@nw',        joined:'2025-09', perms:['author-spec','read-wiki','open-pr'] },
  { name:'Critic Agent',   role:'Reviewer',           kind:'agent', email:'agent:critic@nw',      joined:'2025-09', perms:['review','flag','request-changes'] },
  { name:'Implementer',    role:'Code producer',      kind:'agent', email:'agent:impl@nw',        joined:'2025-09', perms:['open-pr','run-tests','read-secrets:limited'] },
];

const MembersTab = ({ w }) => (
  <>
    <Section title="Humans" sub="People with workspace-level access. Project-level access cascades from here unless explicitly tightened."
      action={<Btn icon="plus" variant="primary" size="sm">Invite</Btn>}>
      <div style={{ marginTop: 4 }}>
        {MEMBERS.filter(m => m.kind === 'human').map((m, i) => <MemberRow key={m.email} m={m} i={i}/>)}
      </div>
    </Section>
    <Section title="Agent identities" sub="Each agent is a first-class identity with its own permission scope. Revoke or restrict scopes here.">
      <div style={{ marginTop: 4 }}>
        {MEMBERS.filter(m => m.kind === 'agent').map((m, i) => <MemberRow key={m.email} m={m} i={i}/>)}
      </div>
    </Section>
  </>
);

const MemberRow = ({ m, i }) => (
  <div className="row-hover" style={{ padding:'10px 4px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'30px 1fr 160px 1fr 80px', gap: 12, alignItems:'center' }}>
    {m.kind === 'human'
      ? <Avatar name={m.name} size={26}/>
      : <div style={{ width: 26, height: 26, borderRadius: 4, background:'var(--blue-soft)', display:'grid', placeItems:'center' }}><Icon name="sparkle" size={13} style={{ color:'var(--blue-bright)' }}/></div>}
    <div>
      <div style={{ fontSize: 13 }}>{m.name}</div>
      <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{m.email}</div>
    </div>
    <span style={{ fontSize: 12, color:'var(--text-dim)' }}>{m.role}</span>
    <div style={{ display:'flex', flexWrap:'wrap', gap: 3 }}>
      {m.perms.map(p => <span key={p} className="chip" style={{ fontSize: 10 }}>{p}</span>)}
    </div>
    <Btn size="sm" variant="ghost">Edit</Btn>
  </div>
);

// ───────────────────── INTEGRATIONS ─────────────────────
const INTEGRATIONS = [
  { id:'github',    name:'GitHub',     status:'connected', detail:'org: northwind-mutual · 7 repos in scope', src:'workspace' },
  { id:'snowflake', name:'Snowflake',  status:'connected', detail:'account: NW.EU_WEST_1 · 4 schemas', src:'domain' },
  { id:'datadog',   name:'Datadog',    status:'connected', detail:'org: northwind · 12 monitors auto-synced', src:'company' },
  { id:'slack',     name:'Slack',      status:'connected', detail:'workspace: northwind · alerts → #cust-portal-ops', src:'workspace' },
  { id:'pager',     name:'PagerDuty',  status:'connected', detail:'service: customer-portal-prod', src:'workspace' },
  { id:'jira',      name:'Jira',       status:'inactive',  detail:'(legacy — superseded by Snappy)', src:'company' },
  { id:'figma',     name:'Figma',      status:'available', detail:'connect to surface UI tokens to Spec Agent', src:'workspace' },
];

const IntegrationsTab = ({ w }) => (
  <Section title="Integrations" sub="External systems agents read from and write to. Status flows from cascade source.">
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 10, marginTop: 6 }}>
      {INTEGRATIONS.map(it => {
        const tone = it.status === 'connected' ? '#10B981' : it.status === 'inactive' ? '#94A3B8' : '#5B8DEF';
        return (
          <div key={it.id} style={{ padding: 12, border:'1px solid var(--line)', borderRadius: 5, background:'var(--raised)', display:'grid', gridTemplateColumns:'30px 1fr auto', gap: 10, alignItems:'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: 4, background:'var(--bg)', display:'grid', placeItems:'center', fontSize: 12, fontWeight: 600, color:'var(--text-dim)' }}>
              {it.name[0]}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ display:'flex', gap: 6, alignItems:'center' }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</span>
                <SourcePill src={it.src}/>
              </div>
              <div style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.detail}</div>
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding:'2px 7px', borderRadius: 3, background:'var(--raised-strong)', color: tone, textTransform:'uppercase', letterSpacing:'0.04em' }}>{it.status}</span>
          </div>
        );
      })}
    </div>
  </Section>
);

// ───────────────────── ENVIRONMENTS ─────────────────────
const ENVS = [
  {
    id:'prod', name:'production', region:'eu-west-1', deployGate:'Two-person + critic-pass', branch:'main',
    secrets:[
      { k:'STRIPE_SECRET_KEY',     ref:'aws-sm:nw/cust/prod/stripe', last:'2026-04-02', usage: 14 },
      { k:'SNOWFLAKE_PASSWORD',    ref:'aws-sm:nw/cust/prod/sf',     last:'2026-04-22', usage: 31 },
      { k:'IDP_CLIENT_SECRET',     ref:'aws-sm:nw/cust/prod/idp',    last:'2026-03-17', usage: 8 },
    ],
  },
  {
    id:'staging', name:'staging', region:'eu-west-1', deployGate:'Critic-pass', branch:'release/*',
    secrets:[
      { k:'STRIPE_SECRET_KEY',     ref:'aws-sm:nw/cust/stg/stripe', last:'2026-04-02', usage: 4 },
      { k:'SNOWFLAKE_PASSWORD',    ref:'aws-sm:nw/cust/stg/sf',     last:'2026-04-22', usage: 12 },
    ],
  },
  {
    id:'dev', name:'dev', region:'eu-west-1', deployGate:'None (auto)', branch:'feature/*',
    secrets:[
      { k:'SNOWFLAKE_PASSWORD',    ref:'aws-sm:nw/cust/dev/sf',     last:'2026-04-22', usage: 88 },
    ],
  },
];

const EnvironmentsTab = ({ w }) => {
  const [open, setOpen] = uS_wsx('prod');
  return (
    <Section title="Environments & secrets" sub="Each environment maps to deploy targets and a scoped secret bundle. Secret values resolve to AWS Secrets Manager at agent runtime — never stored in this UI."
      action={<Btn size="sm" icon="plus">Add environment</Btn>}>
      <div style={{ marginTop: 6 }}>
        {ENVS.map((e, i) => {
          const isOpen = open === e.id;
          const tone = e.id === 'prod' ? '#EF4444' : e.id === 'staging' ? '#F59E0B' : '#10B981';
          return (
            <div key={e.id} style={{ borderTop: i?'1px solid var(--line-soft)':'none' }}>
              <div className="row-hover" onClick={() => setOpen(isOpen ? null : e.id)}
                style={{ padding:'12px 4px', display:'grid', gridTemplateColumns:'12px 100px 1fr 130px 80px 14px', gap: 12, alignItems:'center', cursor:'pointer' }}>
                <span style={{ width: 8, height: 8, borderRadius:'50%', background: tone }}/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
                <span style={{ fontSize: 11.5, color:'var(--text-mute)' }} className="mono">{e.region} · branch <strong style={{ color:'var(--text-dim)' }}>{e.branch}</strong></span>
                <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{e.secrets.length} secrets</span>
                <span style={{ fontSize: 10.5, color: tone, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{e.deployGate.split(' ')[0]}</span>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={11} style={{ color:'var(--text-mute)' }}/>
              </div>
              {isOpen && (
                <div style={{ padding: 14, background:'var(--raised)', borderRadius: 4, marginBottom: 10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom:'1px solid var(--line-soft)' }}>
                    <Kv k="Deploy gate" v={e.deployGate}/>
                    <Kv k="Region" v={e.region}/>
                    <Kv k="Branch pattern" v={e.branch}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
                    <span className="h-eyebrow">Secrets · backed by AWS Secrets Manager</span>
                    <Btn size="sm" icon="plus">Add secret</Btn>
                  </div>
                  <div style={{ background:'var(--bg)', border:'1px solid var(--line-soft)', borderRadius: 4 }}>
                    <div style={{ padding:'8px 12px', display:'grid', gridTemplateColumns:'200px 1fr 100px 80px 50px', gap: 12, fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid var(--line-soft)' }}>
                      <span>Key</span><span>Resolves to</span><span>Last rotated</span><span>Uses (7d)</span><span/>
                    </div>
                    {e.secrets.map((s, j) => (
                      <div key={s.k} style={{ padding:'8px 12px', borderTop: j?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'200px 1fr 100px 80px 50px', gap: 12, fontSize: 12, alignItems:'center' }}>
                        <span className="mono">{s.k}</span>
                        <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{s.ref}</span>
                        <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.last}</span>
                        <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{s.usage}</span>
                        <Icon name="more" size={12} style={{ color:'var(--text-mute)', cursor:'pointer' }}/>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color:'var(--text-mute)' }}>
                    Agents request secrets via short-lived STS tokens; values never leave the Secrets Manager boundary.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
};

const Kv = ({ k, v }) => (
  <div>
    <div style={{ fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{k}</div>
    <div style={{ fontSize: 12, marginTop: 2 }} className="mono">{v}</div>
  </div>
);

// ───────────────────── DATA CLASSES ─────────────────────
const DATA_CLASSES = [
  { id:'PII',    name:'Personally Identifiable Info', tagged: 184, untagged: 3,  src:'company', residency:'EU only' },
  { id:'PCI',    name:'Payment Card Industry',         tagged: 22,  untagged: 0,  src:'company', residency:'EU only · tokenised' },
  { id:'PHI',    name:'Protected Health Info',         tagged: 0,   untagged: 0,  src:'company', residency:'N/A in this WS' },
  { id:'KYC',    name:'Know Your Customer',            tagged: 41,  untagged: 1,  src:'domain',  residency:'EU only' },
  { id:'PUBLIC', name:'Public / non-sensitive',        tagged: 612, untagged: 0,  src:'workspace', residency:'Any' },
];

const DataClassesTab = ({ w }) => (
  <Section title="Data classifications in scope" sub="The classes of data this workspace handles. Each gates downstream policies (residency, masking, retention).">
    <div style={{ marginTop: 6 }}>
      {DATA_CLASSES.map((d, i) => (
        <div key={d.id} style={{ padding:'12px 4px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'60px 1fr 160px 140px 100px', gap: 14, alignItems:'center' }}>
          <span style={{ fontFamily:'JetBrains Mono', fontSize: 11, fontWeight: 600, padding:'3px 6px', background:'var(--raised-strong)', borderRadius: 3, justifySelf:'start' }}>{d.id}</span>
          <span style={{ fontSize: 13 }}>{d.name}</span>
          <span style={{ fontSize: 11.5, color:'var(--text-mute)' }}>
            {d.tagged} tagged fields
            {d.untagged > 0 && <span style={{ color:'var(--amber)' }}> · {d.untagged} untagged</span>}
          </span>
          <span style={{ fontSize: 11.5, color:'var(--text-dim)' }}>{d.residency}</span>
          <SourcePill src={d.src}/>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 14, padding: 10, background:'var(--amber-bg)', border:'1px solid rgba(245,158,11,0.3)', borderRadius: 4, fontSize: 12, color:'#FCD34D', display:'flex', gap: 10, alignItems:'center' }}>
      <Icon name="alert" size={14}/>
      <span>4 untagged fields detected (3 PII, 1 KYC). The Spec Agent will refuse to use them until classified.</span>
      <div style={{ flex:1 }}/>
      <Btn size="sm">Review queue</Btn>
    </div>
  </Section>
);

// ───────────────────── NOTIFICATIONS ─────────────────────
const NotificationsTab = ({ w }) => (
  <>
    <Section title="Routing rules" sub="Which events go where. Defaults inherit from Company.">
      <SettingRow label="Spec ready for review" src="workspace" hint="Posts to the spec author's primary channel + workspace lead."
        control={<select className="select-fake"><option>Slack #cust-portal-specs</option></select>}/>
      <SettingRow label="Critic flagged change" src="workspace" hint="When critic requests changes on an in-flight spec or PR."
        control={<select className="select-fake"><option>Slack DM to author</option></select>}/>
      <SettingRow label="Budget burn 90%" src="workspace" hint="When projected spend exceeds 90% of period cap."
        control={<select className="select-fake"><option>Email + Slack #cust-portal-ops</option></select>}/>
      <SettingRow label="Policy violation" src="company" hint="Company-level: always escalates to Risk & compliance regardless of workspace setting." ovrLocked
        control={<select className="select-fake" disabled><option>Email Maya Patel + #risk-compliance</option></select>}/>
    </Section>
    <Section title="Quiet hours" sub="Soft-mute non-critical alerts. Critical (prod incident, policy violation) always pages.">
      <SettingRow label="Workspace quiet hours" src="workspace" hint="Times when non-critical Slack alerts batch into a digest instead of pinging immediately."
        control={<div style={{ display:'flex', gap: 8 }}><Field value="20:00" w="80px"/><span style={{ alignSelf:'center', fontSize: 12, color:'var(--text-mute)' }}>→</span><Field value="08:00" w="80px"/></div>}/>
    </Section>
  </>
);

// ───────────────────── CASCADE ─────────────────────
const CascadeTab = ({ w, navigate }) => (
  <>
    <Section title="Inheritance chain" sub="Settings cascade: Company → Domain → Workspace → Project. Lower levels can tighten but not loosen unless explicitly granted.">
      <div style={{ display:'flex', alignItems:'stretch', gap: 0, marginTop: 12 }}>
        {[
          { l:'Company', n:'Northwind Mutual', count:'42 settings', src:'company', go:'/organisation/company' },
          { l:'Domain',  n:`${w.domain || 'Customer'}`, count:'14 overrides · 0 violations', src:'domain', go:'/organisation/company/domains' },
          { l:'Workspace', n: w.name, count:'9 overrides · 1 violation', src:'workspace', here: true, go:`/workspace/${w.id}/settings` },
          { l:'Project', n:'(per-project)', count:'2-5 overrides each', src:'project', go: null },
        ].map((c, i) => (
          <React.Fragment key={c.l}>
            <div onClick={() => c.go && navigate(c.go)}
              style={{
                flex:1, padding: 14, border:`1px solid ${c.here ? 'var(--blue-bright)' : 'var(--line)'}`,
                borderRadius: 5, background: c.here ? 'var(--blue-soft)' : 'var(--raised)',
                cursor: c.go ? 'pointer' : 'default',
                display:'flex', flexDirection:'column', gap: 4, minWidth: 0,
              }}>
              <SourcePill src={c.src}/>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{c.n}</div>
              <div style={{ fontSize: 11, color:'var(--text-mute)' }}>{c.count}</div>
            </div>
            {i < 3 && <div style={{ display:'grid', placeItems:'center', padding:'0 10px', color:'var(--text-mute)' }}><Icon name="chevron-right" size={14}/></div>}
          </React.Fragment>
        ))}
      </div>
    </Section>
    <Section title="Overrides applied here" sub="Settings where this workspace has chosen a different value than would have inherited.">
      <div style={{ marginTop: 4 }}>
        {[
          { setting:'Monthly cap',           inherited:'$24,000', override:'$18,000', why:'Tightened — this WS historically peaks at $14k.' },
          { setting:'Per-PR cap',            inherited:'$8',      override:'$8 (none)', why:'No change.' },
          { setting:'Burn-rate alert',       inherited:'95%',     override:'90%',      why:'Earlier warning preferred by lead.' },
          { setting:'Quiet hours',           inherited:'22:00-07:00', override:'20:00-08:00', why:'EU-based team.' },
          { setting:'Premium model usage',   inherited:'≤30%',    override:'≤20%',     why:'Cost optimisation Q2.' },
        ].map((o, i) => (
          <div key={i} style={{ padding:'10px 4px', borderTop: i?'1px solid var(--line-soft)':'none', display:'grid', gridTemplateColumns:'180px 130px 130px 1fr', gap: 14, alignItems:'center' }}>
            <span style={{ fontSize: 12.5 }}>{o.setting}</span>
            <span style={{ fontSize: 11.5, color:'var(--text-mute)', textDecoration:'line-through' }}>{o.inherited}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{o.override}</span>
            <span style={{ fontSize: 11, color:'var(--text-mute)' }}>{o.why}</span>
          </div>
        ))}
      </div>
    </Section>
  </>
);

window.WorkspaceSettings = WorkspaceSettings;

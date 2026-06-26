/* global React, Icon, Btn, Avatar, Pill, StatusDot */
const { useState: uS_c4, useMemo: uM_c4, useRef: uR_c4, useEffect: uE_c4 } = React;

// ─────────────────────────────────────────────────────────────────────────
// C4 EXPLORER
// L1 Context  → external systems + people + Northwind boundary
// L2 Container → workspaces / services / data stores within Northwind
// L3 Component → modules inside a chosen container
//
// Aside: identity, owners, tech, data, health, links, "agent context" button
// Overlays: cascade ownership, flow lighting (pick a Business Process)
// ─────────────────────────────────────────────────────────────────────────

// ——— DATA ———

const C4_OWNERS = {
  'customer-portal':  { ws:'customer-portal',     domain:'Customer',  lead:'Anna Lindqvist', shared:false },
  'policy-uw':        { ws:'policy-underwriting', domain:'Policy',    lead:'Chris Okafor',   shared:false },
  'fraud-claims':     { ws:'fraud-claims',        domain:'Claims',    lead:'Dimitri Volkov', shared:false },
  'platform':         { ws:'platform',            domain:'Platform',  lead:'Alex Tomic',     shared:false },
  'lending-data':     { ws:'lending-data',        domain:'Data & Analytics', lead:'Priya Singh', shared:false },
};

// L1: people + external systems + Northwind boundary
const L1_NODES = [
  { id:'p:customer',        kind:'person',   label:'Policyholder',         x: 60,  y: 60,  desc:'Files claims and manages policies via web/mobile portal.' },
  { id:'p:cs-agent',        kind:'person',   label:'CS agent',             x: 60,  y: 200, desc:'Internal customer support representative.' },
  { id:'p:adjuster',        kind:'person',   label:'Claims adjuster',      x: 60,  y: 340, desc:'Reviews escalated/manual-route claims.' },
  { id:'p:underwriter',     kind:'person',   label:'Underwriter',          x: 60,  y: 480, desc:'Manual review for risky/complex policies.' },
  { id:'sys:northwind',     kind:'system',   label:'Northwind Mutual',     x: 380, y: 270, w: 380, h: 360, internal:true,
    desc:'The Northwind insurance platform — portal, policy core, claims, fraud, platform services, analytics.' },
  { id:'ext:bureau',        kind:'external', label:'Credit bureau',        x: 880, y: 60,  desc:'Third-party credit data — calls under contract.' },
  { id:'ext:lexis',         kind:'external', label:'LexisNexis Risk',      x: 880, y: 200, desc:'Identity & fraud signals.' },
  { id:'ext:stripe',        kind:'external', label:'Stripe',               x: 880, y: 340, desc:'Card capture; PCI scope minimised.' },
  { id:'ext:plaid',         kind:'external', label:'Plaid',                x: 880, y: 480, desc:'Bank account linking for payouts.' },
  { id:'ext:hmrc',          kind:'external', label:'HMRC reporting',       x: 880, y: 610, desc:'Tax/regulatory submission gateway.' },
  { id:'ext:auth0',         kind:'external', label:'Auth0',                x: 60,  y: 610, desc:'Federated IdP for staff SSO.' },
];
const L1_EDGES = [
  { from:'p:customer',     to:'sys:northwind', label:'Manages policies / files claims' },
  { from:'p:cs-agent',     to:'sys:northwind', label:'Resolves cases' },
  { from:'p:adjuster',     to:'sys:northwind', label:'Reviews claims' },
  { from:'p:underwriter',  to:'sys:northwind', label:'Underwrites' },
  { from:'sys:northwind',  to:'ext:bureau',    label:'Pulls credit (REST)' },
  { from:'sys:northwind',  to:'ext:lexis',     label:'ID / fraud signals' },
  { from:'sys:northwind',  to:'ext:stripe',    label:'Tokenise card' },
  { from:'sys:northwind',  to:'ext:plaid',     label:'Verify bank' },
  { from:'sys:northwind',  to:'ext:hmrc',      label:'Tax reports (sFTP)' },
  { from:'p:cs-agent',     to:'ext:auth0',     label:'SSO', dashed:true },
  { from:'p:adjuster',     to:'ext:auth0',     label:'SSO', dashed:true },
  { from:'p:underwriter',  to:'ext:auth0',     label:'SSO', dashed:true },
];

// L2 (containers within Northwind). Coordinates form clean lanes.
const L2_NODES = [
  // Customer-facing
  { id:'web',          kind:'web',      tech:'React',         label:'Web portal',          x: 60,  y: 60,  ws:'customer-portal',
    desc:'Customer self-serve portal — policies, claims, billing.' },
  { id:'mobile',       kind:'web',      tech:'React Native',  label:'Mobile app',          x: 60,  y: 180, ws:'customer-portal',
    desc:'iOS/Android app, biometric auth.' },
  { id:'portal-bff',   kind:'service',  tech:'Node 20',       label:'portal-bff',          x: 280, y: 120, ws:'customer-portal',
    desc:'GraphQL gateway aggregating customer-facing services.' },

  // Identity / shared (multi-owned)
  { id:'identity-svc', kind:'service',  tech:'Go',            label:'identity-svc',        x: 280, y: 280, ws:'platform', extraWs:['customer-portal'], shared:true,
    desc:'Customer + staff identity, sessions, MFA.' },
  { id:'profile-svc',  kind:'service',  tech:'Node 20',       label:'profile-svc',         x: 280, y: 400, ws:'customer-portal',
    desc:'Customer profile, preferences, contact methods.' },
  { id:'consent-svc',  kind:'service',  tech:'Node 20',       label:'consent-svc',         x: 480, y: 460, ws:'customer-portal', extraWs:['policy-underwriting'], shared:true,
    desc:'Marketing & data consent capture, audit-grade.' },

  // Policy
  { id:'quote-svc',    kind:'service',  tech:'Java 21',       label:'quote-svc',           x: 540, y: 80,  ws:'policy-uw',
    desc:'Pricing & quote generation; pulls from rate tables and bureau.' },
  { id:'policy-store', kind:'service',  tech:'Java 21',       label:'policy-store',        x: 540, y: 220, ws:'policy-uw',
    desc:'System of record for policies (bind/renew/cancel).' },
  { id:'rates-db',     kind:'db',       tech:'PostgreSQL',    label:'rates-db',            x: 760, y: 80,  ws:'policy-uw',
    desc:'Underwriting rate tables and bands.' },
  { id:'policy-db',    kind:'db',       tech:'PostgreSQL',    label:'policy-db',           x: 760, y: 220, ws:'policy-uw',
    desc:'Policy state, beneficiaries, schedule.' },

  // Claims
  { id:'intake-svc',   kind:'service',  tech:'Node 20',       label:'intake-svc',          x: 540, y: 340, ws:'fraud-claims',
    desc:'First-notice-of-loss capture, document upload, validation.' },
  { id:'fraud-scorer', kind:'service',  tech:'Python 3.12',   label:'fraud-scorer',        x: 760, y: 340, ws:'fraud-claims', extraWs:['platform'], shared:true,
    desc:'ML scoring service. Reads Snowflake gold features.' },
  { id:'adjud-engine', kind:'service',  tech:'Java 21',       label:'adjud-engine',        x: 760, y: 460, ws:'fraud-claims',
    desc:'Rules + ML adjudication; produces reserve/payout.' },
  { id:'claims-db',    kind:'db',       tech:'PostgreSQL',    label:'claims-db',           x: 980, y: 340, ws:'fraud-claims',
    desc:'Claim records, reserves, decisions.' },

  // Platform
  { id:'audit-trail',  kind:'service',  tech:'Rust',          label:'audit-trail-svc',     x: 480, y: 600, ws:'platform',
    desc:'Append-only event log. Source of truth for compliance.' },
  { id:'audit-store',  kind:'db',       tech:'ClickHouse',    label:'audit-store',         x: 720, y: 600, ws:'platform',
    desc:'Immutable hourly-rolled events, hashed chain.' },
  { id:'kafka',        kind:'queue',    tech:'Kafka 3.7',     label:'kafka:cluster',       x: 280, y: 600, ws:'platform',
    desc:'Event backbone. Customer + claims + billing topics.' },

  // Data
  { id:'sf',           kind:'db',       tech:'Snowflake',     label:'sf:gold',             x: 980, y: 600, ws:'lending-data',
    desc:'Gold tier — cust_360, fraud_features, billing_marts.' },
];
const L2_EDGES = [
  { from:'web',          to:'portal-bff',   label:'GraphQL/HTTPS' },
  { from:'mobile',       to:'portal-bff',   label:'GraphQL/HTTPS' },
  { from:'portal-bff',   to:'identity-svc', label:'session check' },
  { from:'portal-bff',   to:'profile-svc',  label:'gRPC' },
  { from:'profile-svc',  to:'consent-svc',  label:'gRPC' },
  { from:'consent-svc',  to:'kafka',        label:'consent.events' },
  { from:'identity-svc', to:'kafka',        label:'identity.events' },
  { from:'portal-bff',   to:'quote-svc',    label:'GraphQL stitch' },
  { from:'quote-svc',    to:'rates-db',     label:'reads' },
  { from:'quote-svc',    to:'policy-store', label:'binds' },
  { from:'policy-store', to:'policy-db',    label:'reads/writes' },
  { from:'policy-store', to:'kafka',        label:'policy.events' },
  { from:'portal-bff',   to:'intake-svc',   label:'GraphQL stitch' },
  { from:'intake-svc',   to:'kafka',        label:'claim.intake.v3' },
  { from:'kafka',        to:'fraud-scorer', label:'consumes' },
  { from:'fraud-scorer', to:'sf',           label:'reads features' },
  { from:'fraud-scorer', to:'adjud-engine', label:'score (gRPC)' },
  { from:'adjud-engine', to:'claims-db',    label:'writes' },
  { from:'adjud-engine', to:'policy-store', label:'shares-DB connection', kind:'shares-DB' },
  { from:'kafka',        to:'audit-trail',  label:'fanout' },
  { from:'audit-trail',  to:'audit-store',  label:'append' },
  { from:'kafka',        to:'sf',           label:'sink (Snowpipe)' },
];

// L3 — components inside one container. We'll pick `fraud-scorer` as the rich example
// and provide minimal stubs for a couple of others.
const L3_BY_CONTAINER = {
  'fraud-scorer': {
    title: 'fraud-scorer',
    desc:  'ML-driven risk scoring service. Stateless; pulls features from Snowflake gold tier and serves a /score endpoint.',
    tech:  'Python 3.12 · FastAPI · scikit-learn · ONNX runtime',
    ws:    'fraud-claims',
    extraWs:['platform'],
    nodes: [
      { id:'http',        kind:'component', label:'HTTP layer (FastAPI)',     x:80,  y:60,  desc:'Auth, request shape, rate limiting.' },
      { id:'feat',        kind:'component', label:'Feature loader',           x:80,  y:200, desc:'Pulls customer features from Snowflake; in-memory LRU cache.' },
      { id:'enrich',      kind:'component', label:'Real-time enrichment',     x:340, y:130, desc:'Lex+geoIP+device-fp augmentation.' },
      { id:'model',       kind:'component', label:'Model registry',           x:340, y:280, desc:'Loads ONNX models, A/B routes, shadow logging.' },
      { id:'score',       kind:'component', label:'Scorer',                   x:600, y:200, desc:'Runs the ensemble; returns score + drivers.' },
      { id:'expl',        kind:'component', label:'Explainability',           x:600, y:340, desc:'SHAP value emit for high-risk scores.' },
      { id:'audit',       kind:'component', label:'Audit emitter',            x:860, y:200, desc:'Pushes decision + reasoning to audit-trail-svc.' },
      { id:'metrics',     kind:'component', label:'Metrics + drift monitor',  x:860, y:340, desc:'Prometheus metrics; drift alerts to Polaris.' },
      // External (in dotted box)
      { id:'ext:sf',      kind:'external-db', label:'Snowflake gold',         x:80,  y:380, desc:'sf:gold.fraud_features' },
      { id:'ext:adjud',   kind:'external-svc',label:'adjud-engine',           x:1080,y:130, desc:'Consumes /score' },
      { id:'ext:audit',   kind:'external-svc',label:'audit-trail-svc',        x:1080,y:280, desc:'Consumes events' },
    ],
    edges: [
      { from:'http',  to:'feat',  label:'request' },
      { from:'http',  to:'enrich',label:'augment' },
      { from:'feat',  to:'ext:sf',label:'SQL' },
      { from:'enrich',to:'score', label:'enriched ctx' },
      { from:'feat',  to:'score', label:'features' },
      { from:'score', to:'model', label:'load model' },
      { from:'score', to:'expl',  label:'if score≥0.7' },
      { from:'score', to:'audit', label:'decision' },
      { from:'expl',  to:'audit', label:'reasoning' },
      { from:'audit', to:'ext:audit', label:'gRPC' },
      { from:'ext:adjud', to:'http', label:'/score' },
      { from:'metrics', to:'http', label:'reads', dashed:true },
    ],
  },
  'portal-bff': {
    title:'portal-bff',
    desc:'GraphQL gateway aggregating customer-facing services.',
    tech:'Node 20 · Apollo Gateway · Redis cache',
    ws:'customer-portal',
    nodes:[
      { id:'gw',     kind:'component', label:'Apollo gateway',  x:120, y:120, desc:'Schema stitching across subgraphs.' },
      { id:'auth',   kind:'component', label:'Auth middleware', x:120, y:260, desc:'Verifies session via identity-svc.' },
      { id:'cache',  kind:'component', label:'Redis cache',     x:380, y:120, desc:'Per-customer query cache.' },
      { id:'subg',   kind:'component', label:'Subgraph clients',x:380, y:260, desc:'profile, policy, claims, billing.' },
      { id:'ext:profile', kind:'external-svc', label:'profile-svc',  x:640, y:120, desc:'' },
      { id:'ext:policy',  kind:'external-svc', label:'policy-store', x:640, y:200, desc:'' },
      { id:'ext:intake',  kind:'external-svc', label:'intake-svc',   x:640, y:280, desc:'' },
    ],
    edges:[
      { from:'gw', to:'auth' },
      { from:'gw', to:'cache' },
      { from:'gw', to:'subg' },
      { from:'subg', to:'ext:profile' },
      { from:'subg', to:'ext:policy' },
      { from:'subg', to:'ext:intake' },
    ],
  },
  'adjud-engine': {
    title:'adjud-engine',
    desc:'Adjudication engine — rules + ML; produces reserves and payouts.',
    tech:'Java 21 · Drools · Spring',
    ws:'fraud-claims',
    nodes:[
      { id:'orchestr', kind:'component', label:'Orchestrator',   x:120, y:140, desc:'Walks the BPMN-like decision graph.' },
      { id:'rules',    kind:'component', label:'Rules engine',   x:380, y:80,  desc:'Drools rule packs by line of business.' },
      { id:'ml',       kind:'component', label:'ML adapter',     x:380, y:220, desc:'Consumes fraud-scorer.' },
      { id:'reserve',  kind:'component', label:'Reserve calc',   x:640, y:140, desc:'Computes loss reserve estimate.' },
      { id:'pay',      kind:'component', label:'Payout writer',  x:640, y:280, desc:'Writes payout intent.' },
      { id:'ext:fs',   kind:'external-svc', label:'fraud-scorer', x:120, y:300, desc:'' },
      { id:'ext:db',   kind:'external-db',  label:'claims-db',    x:880, y:140, desc:'' },
    ],
    edges:[
      { from:'orchestr', to:'rules' },
      { from:'orchestr', to:'ml' },
      { from:'ml', to:'ext:fs' },
      { from:'rules', to:'reserve' },
      { from:'reserve', to:'pay' },
      { from:'pay', to:'ext:db' },
    ],
  },
};

// Health, drift, owners, links per container.
const C4_DETAIL = {
  'web':          { health:'green', sla:'99.92% (90d)', incidents:0, owners:['Anna Lindqvist','Marco Reyes'], specs:['SPEC-074','SPEC-068'], adrs:['ADR-22'], processes:['BP-NEW-POL'], terms:['Policyholder'] },
  'mobile':       { health:'green', sla:'99.85% (90d)', incidents:0, owners:['Marco Reyes'], specs:['SPEC-068'], adrs:[], processes:['BP-NEW-POL'], terms:['Policyholder'] },
  'portal-bff':   { health:'green', sla:'99.94% (90d)', incidents:1, owners:['Anna Lindqvist'], specs:['SPEC-074','SPEC-061'], adrs:['ADR-19'], processes:['BP-NEW-POL','BP-CLAIM-FT'], terms:['Policyholder'] },
  'identity-svc': { health:'amber', sla:'99.88% (90d)', incidents:2, owners:['Alex Tomic','Anna Lindqvist'], specs:['SPEC-052','SPEC-061'], adrs:['ADR-04','ADR-19'], processes:['BP-NEW-POL'], terms:['CHID'], note:'Multi-workspace ownership.' },
  'profile-svc':  { health:'green', sla:'99.95% (90d)', incidents:0, owners:['Anna Lindqvist'], specs:['SPEC-061'], adrs:[], processes:[], terms:['Policyholder'] },
  'consent-svc':  { health:'green', sla:'99.99% (90d)', incidents:0, owners:['Anna Lindqvist','Chris Okafor'], specs:['SPEC-049'], adrs:['ADR-11'], processes:['BP-GDPR-DSR'], terms:['Policyholder'], note:'Multi-workspace ownership.' },
  'quote-svc':    { health:'green', sla:'99.91% (90d)', incidents:0, owners:['Chris Okafor'], specs:['SPEC-022'], adrs:['ADR-07'], processes:['BP-NEW-POL'], terms:['Quote applicant','Policyholder'] },
  'policy-store': { health:'green', sla:'99.96% (90d)', incidents:0, owners:['Chris Okafor'], specs:['SPEC-022','SPEC-031'], adrs:['ADR-07'], processes:['BP-NEW-POL','BP-RENEW'], terms:['Policyholder','Beneficiary'] },
  'rates-db':     { health:'green', sla:'-',           incidents:0, owners:['Chris Okafor'], specs:[], adrs:[], processes:['BP-NEW-POL'], terms:[] },
  'policy-db':    { health:'green', sla:'-',           incidents:0, owners:['Chris Okafor'], specs:[], adrs:[], processes:['BP-NEW-POL'], terms:['Policyholder'] },
  'intake-svc':   { health:'green', sla:'99.93% (90d)', incidents:1, owners:['Sarah Chen'], specs:['SPEC-091'], adrs:['ADR-25'], processes:['BP-CLAIM-FT'], terms:['Claim'] },
  'fraud-scorer': { health:'amber', sla:'99.91% (90d)', incidents:1, owners:['Sarah Chen','Alex Tomic'], specs:['SPEC-091','SPEC-104'], adrs:['ADR-25','ADR-31'], processes:['BP-CLAIM-FT'], terms:['Claim','Adjudication'], note:'Multi-workspace ownership. Drift > 0.04 vs train baseline.' },
  'adjud-engine': { health:'green', sla:'99.94% (90d)', incidents:0, owners:['Dimitri Volkov'], specs:['SPEC-091'], adrs:['ADR-25'], processes:['BP-CLAIM-FT'], terms:['Adjudication','Reserve','Payout'] },
  'claims-db':    { health:'green', sla:'-',           incidents:0, owners:['Dimitri Volkov'], specs:[], adrs:[], processes:['BP-CLAIM-FT'], terms:['Claim','Reserve'] },
  'audit-trail':  { health:'green', sla:'99.999% (90d)', incidents:0, owners:['Alex Tomic'], specs:['SPEC-049'], adrs:['ADR-11'], processes:['BP-GDPR-DSR'], terms:[] },
  'audit-store':  { health:'green', sla:'-',           incidents:0, owners:['Alex Tomic'], specs:[], adrs:[], processes:[], terms:[] },
  'kafka':        { health:'green', sla:'99.98% (90d)', incidents:0, owners:['Alex Tomic'], specs:[], adrs:['ADR-04'], processes:[], terms:[] },
  'sf':           { health:'green', sla:'-',           incidents:0, owners:['Priya Singh'], specs:['SPEC-104'], adrs:['ADR-31'], processes:[], terms:[] },
};

// Workspace tone — used for cascade overlay.
const WS_TONE = {
  'customer-portal':     '#5B8DEF',
  'policy-underwriting': '#10B981',
  'fraud-claims':        '#F59E0B',
  'platform':            '#A78BFA',
  'lending-data':        '#22D3EE',
  '_shared':             '#EC4899',
};
const WS_LABEL = {
  'customer-portal':     'Customer portal',
  'policy-underwriting': 'Policy & UW',
  'fraud-claims':        'Fraud & claims',
  'platform':            'Platform',
  'lending-data':        'Lending data',
};

// Business processes the user can light up.
const FLOWS = [
  {
    id:'BP-CLAIM-FT', label:'Motor claim — fast-track',
    path: ['p:customer','web','portal-bff','intake-svc','kafka','fraud-scorer','adjud-engine','claims-db','audit-trail'],
    notes:'Customer files a claim; intake validates; kafka fans out; fraud-scorer reads gold features; adjud-engine produces reserve/payout; audit captures.',
  },
  {
    id:'BP-NEW-POL', label:'New motor policy — quote→bind',
    path: ['p:customer','web','portal-bff','quote-svc','rates-db','policy-store','policy-db','kafka'],
    notes:'Quote pulls rates, applicant binds, policy-store records.',
  },
  {
    id:'BP-GDPR-DSR', label:'GDPR data-subject request',
    path: ['p:customer','web','portal-bff','identity-svc','consent-svc','audit-trail','audit-store'],
    notes:'Erasure / portability flows: identity → consent → append-only audit.',
  },
];

// Project diff overlay — what this branch changes.
const PROJECT_DIFFS = {
  'lending-modernisation': {
    label:'Lending modernisation (in flight)',
    added:    ['rates-db'],
    modified: ['quote-svc','policy-store'],
    removed:  [],
    note:'Deprecates legacy mainframe call; introduces Snowflake-backed rates table.',
  },
  'fraud-uplift-2026': {
    label:'Fraud uplift 2026 (in flight)',
    added:    [],
    modified: ['fraud-scorer','intake-svc','adjud-engine'],
    removed:  [],
    note:'Switches scorer to ensemble; intake adds device-fp; adjud picks up explainability payload.',
  },
};

// ——— LAYOUT WIDGETS ———

const KIND_TONE = {
  person:        { stroke:'#5B8DEF', fill:'#1B2434', icon:'user' },
  external:      { stroke:'#94A3B8', fill:'#1B2434', icon:'globe' },
  system:        { stroke:'#5B8DEF', fill:'#0F1620', icon:'cube' },
  web:           { stroke:'#22D3EE', fill:'#0F1A22', icon:'globe' },
  service:       { stroke:'#5B8DEF', fill:'#0F1620', icon:'cube' },
  db:            { stroke:'#A78BFA', fill:'#15172A', icon:'database' },
  queue:         { stroke:'#F59E0B', fill:'#1A1810', icon:'layers' },
  component:     { stroke:'#5B8DEF', fill:'#0F1620', icon:'cube' },
  'external-svc':{ stroke:'#94A3B8', fill:'#0E1420', icon:'cube',     dashed:true },
  'external-db': { stroke:'#94A3B8', fill:'#0E1420', icon:'database', dashed:true },
};

// One node — used at every level, with a uniform card look.
const C4Node = ({ n, selected, dim, lit, overlayWs, onPick, w = 160, h = 64 }) => {
  const t = KIND_TONE[n.kind] || KIND_TONE.service;
  const wsTone = overlayWs ? (n.shared ? WS_TONE._shared : WS_TONE[C4_OWNERS[n.ws]?.ws] || WS_TONE[n.ws] || t.stroke) : t.stroke;
  const stroke = lit ? '#FBBF24' : wsTone;
  const sw = lit ? 2.4 : (selected ? 2.2 : 1.4);
  const op = dim ? 0.32 : 1;
  const isPerson = n.kind === 'person';
  const isSystem = n.kind === 'system';

  if (isSystem) {
    return (
      <g style={{ cursor:'pointer', opacity: op }} onClick={() => onPick && onPick(n)}>
        <rect x={n.x} y={n.y - n.h/2 + 30} width={n.w} height={n.h} rx="8" fill={t.fill} stroke={stroke} strokeWidth={sw} strokeDasharray="4 3"/>
        <text x={n.x + 14} y={n.y - n.h/2 + 50} fontSize="11" fill="#94A3B8" fontFamily="JetBrains Mono">[ Software System ]</text>
        <text x={n.x + 14} y={n.y - n.h/2 + 72} fontSize="15" fontWeight="600" fill="#E5EAF2">{n.label}</text>
        <text x={n.x + 14} y={n.y - n.h/2 + 90} fontSize="11" fill="#5C6779">Click to drill into containers →</text>
      </g>
    );
  }

  if (isPerson) {
    return (
      <g style={{ cursor:'pointer', opacity: op }} onClick={() => onPick && onPick(n)}>
        <circle cx={n.x + w/2} cy={n.y - 12} r="14" fill={t.fill} stroke={stroke} strokeWidth={sw}/>
        <path d={`M${n.x + w/2 - 12} ${n.y + 14} a12,8 0 0,1 24,0`} fill={t.fill} stroke={stroke} strokeWidth={sw}/>
        <text x={n.x + w/2} y={n.y + 38} fontSize="12" fontWeight="500" fill="#E5EAF2" textAnchor="middle">{n.label}</text>
      </g>
    );
  }

  const tech = n.tech;
  return (
    <g style={{ cursor:'pointer', opacity: op }} onClick={() => onPick && onPick(n)}>
      <rect x={n.x} y={n.y} width={w} height={h} rx="5" fill={t.fill} stroke={stroke} strokeWidth={sw} strokeDasharray={t.dashed ? '4 3' : 'none'}/>
      {n.shared && overlayWs && (
        <>
          <circle cx={n.x + w - 10} cy={n.y + 10} r="6" fill={WS_TONE._shared}/>
          <text x={n.x + w - 10} y={n.y + 12.5} fontSize="8" fontWeight="700" fill="#0F1620" textAnchor="middle">2+</text>
        </>
      )}
      <text x={n.x + 11} y={n.y + 17} fontSize="9.5" fill="#94A3B8" fontFamily="JetBrains Mono" style={{ textTransform:'uppercase' }}>[ {n.kind === 'external-svc' || n.kind === 'external-db' ? 'External' : n.kind} ]</text>
      <text x={n.x + 11} y={n.y + 36} fontSize="13" fontWeight="500" fill="#E5EAF2">{n.label}</text>
      {tech && <text x={n.x + 11} y={n.y + 53} fontSize="10" fill="#5C6779" fontFamily="JetBrains Mono">{tech}</text>}
      {!tech && n.desc && <text x={n.x + 11} y={n.y + 53} fontSize="10" fill="#5C6779">{n.desc.length > 30 ? n.desc.slice(0,28)+'…' : n.desc}</text>}
    </g>
  );
};

// Edge with label and arrow.
const C4Edge = ({ from, to, label, dashed, kind, lit, dim, w = 160, h = 64, allNodes }) => {
  const a = allNodes.find(n => n.id === from);
  const b = allNodes.find(n => n.id === to);
  if (!a || !b) return null;
  const ax = (a.kind === 'person') ? a.x + w/2 : (a.kind === 'system' ? a.x + a.w/2 : a.x + w/2);
  const ay = (a.kind === 'person') ? a.y + 8 : (a.kind === 'system' ? a.y + 30 : a.y + h/2);
  const bx = (b.kind === 'person') ? b.x + w/2 : (b.kind === 'system' ? b.x + b.w/2 : b.x + w/2);
  const by = (b.kind === 'person') ? b.y + 8 : (b.kind === 'system' ? b.y + 30 : b.y + h/2);
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const stroke = lit ? '#FBBF24' : (kind === 'shares-DB' ? '#EF4444' : '#5B8DEF');
  const op = dim ? 0.18 : (lit ? 0.95 : 0.55);
  const sw = lit ? 2.2 : 1.3;

  return (
    <g style={{ opacity: op }}>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={sw} strokeDasharray={(dashed || kind==='shares-DB') ? '5 3' : 'none'} markerEnd={lit ? 'url(#c4-arr-lit)' : 'url(#c4-arr)'}/>
      {label && (
        <g>
          <rect x={mx - Math.min(label.length * 3.4, 90)} y={my - 8} width={Math.min(label.length * 6.8, 180)} height="14" rx="2" fill="#0A0E14" opacity="0.92"/>
          <text x={mx} y={my + 2.5} fontSize="10" fill={lit ? '#FBBF24' : '#94A3B8'} textAnchor="middle" fontFamily="Inter">{label}</text>
        </g>
      )}
    </g>
  );
};

// ——— MAIN EXPLORER ———

const C4Explorer = ({ subRoute = [], navigate }) => {
  // subRoute: [level, containerId?]
  // /organisation/company/c4              -> L1
  // /organisation/company/c4/l2           -> L2
  // /organisation/company/c4/l3/<id>      -> L3 (container)
  const level = subRoute[0] === 'l3' ? 'l3' : (subRoute[0] === 'l2' ? 'l2' : 'l1');
  const containerId = level === 'l3' ? subRoute[1] : null;

  const [picked, setPicked]       = uS_c4(null);                  // node id of selected card
  const [overlayWs, setOverlayWs] = uS_c4(false);                 // colour by workspace ownership
  const [flowId, setFlowId]       = uS_c4(null);                  // active flow lighting
  const [diffId, setDiffId]       = uS_c4(null);                  // active project diff
  const [agentOpen, setAgentOpen] = uS_c4(false);

  const flow = FLOWS.find(f => f.id === flowId);
  const diff = PROJECT_DIFFS[diffId];

  // figure out node sets per level
  const nodes = level === 'l1' ? L1_NODES
              : level === 'l2' ? L2_NODES
              : (L3_BY_CONTAINER[containerId]?.nodes || []);
  const edges = level === 'l1' ? L1_EDGES
              : level === 'l2' ? L2_EDGES
              : (L3_BY_CONTAINER[containerId]?.edges || []);

  const litSet = uM_c4(() => new Set(flow ? flow.path : []), [flow]);
  const litEdges = uM_c4(() => {
    if (!flow) return new Set();
    const s = new Set();
    for (let i = 0; i < flow.path.length - 1; i++) s.add(flow.path[i] + '→' + flow.path[i+1]);
    return s;
  }, [flow]);

  const onPick = (n) => {
    setPicked(n.id);
    if (n.kind === 'system' && level === 'l1') navigate('/organisation/company/c4/l2');
  };

  const selectedNode = nodes.find(n => n.id === picked) || null;

  // canvas dimensions
  const VB = level === 'l1' ? '0 0 1080 720'
            : level === 'l2' ? '0 0 1180 720'
            : '0 0 1240 480';

  return (
    <div>
      {/* Header bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 14, gap: 14 }}>
        <div style={{ flex:1 }}>
          <h2 style={{ margin:0, fontSize: 17, fontWeight: 600 }}>C4 explorer</h2>
          <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginTop: 3 }}>One canonical model of how Northwind is built. Drill from system → containers → components, overlay ownership and live flows.</div>
        </div>
        <Btn icon="sparkle" onClick={() => setAgentOpen(true)}>Agent context</Btn>
      </div>

      {/* Breadcrumb + level pills */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display:'flex', alignItems:'center', gap: 12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 12, color:'var(--text-dim)' }}>
          <span style={{ cursor:'pointer', color: level==='l1' ? 'var(--text)' : 'var(--text-dim)' }} onClick={() => navigate('/organisation/company/c4')}>L1 · Context</span>
          <Icon name="chevron-right" size={10} style={{ color:'var(--text-faint)' }}/>
          <span style={{ cursor:'pointer', color: level==='l2' ? 'var(--text)' : 'var(--text-dim)' }} onClick={() => navigate('/organisation/company/c4/l2')}>L2 · Container</span>
          <Icon name="chevron-right" size={10} style={{ color:'var(--text-faint)' }}/>
          <span style={{ color: level==='l3' ? 'var(--text)' : 'var(--text-faint)' }}>
            L3 · Component {level==='l3' && containerId ? `· ${containerId}` : ''}
          </span>
        </div>

        <div style={{ width: 1, alignSelf:'stretch', background:'var(--line-soft)' }}/>

        {/* Overlays */}
        <label style={{ display:'flex', alignItems:'center', gap: 6, fontSize: 11.5, color:'var(--text-dim)', cursor:'pointer' }}>
          <input type="checkbox" checked={overlayWs} onChange={e => setOverlayWs(e.target.checked)} style={{ accentColor:'var(--blue)' }}/>
          Cascade overlay
        </label>

        <select value={flowId || ''} onChange={e => setFlowId(e.target.value || null)} className="select-fake" style={{ width: 240, height: 26, fontSize: 11.5 }}>
          <option value="">Light a business process…</option>
          {FLOWS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        {level === 'l2' && (
          <select value={diffId || ''} onChange={e => setDiffId(e.target.value || null)} className="select-fake" style={{ width: 220, height: 26, fontSize: 11.5 }}>
            <option value="">Project diff overlay…</option>
            {Object.entries(PROJECT_DIFFS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </select>
        )}

        <div style={{ flex:1 }}/>
        <span className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)' }}>{nodes.length} nodes · {edges.length} edges</span>
      </div>

      {/* Active overlays banners */}
      {flow && (
        <div className="card" style={{ padding:'10px 14px', marginBottom: 12, background:'rgba(251,191,36,0.06)', borderColor:'rgba(251,191,36,0.3)', display:'flex', alignItems:'center', gap: 10 }}>
          <Icon name="bolt" size={13} style={{ color:'#FBBF24' }}/>
          <div style={{ fontSize: 12 }}>
            <strong style={{ color:'#FBBF24' }}>Lit path · {flow.label}</strong>
            <span style={{ color:'var(--text-dim)', marginLeft: 8 }}>{flow.notes}</span>
          </div>
          <div style={{ flex:1 }}/>
          <button className="btn sm ghost" onClick={() => setFlowId(null)}>Clear</button>
        </div>
      )}

      {diff && level === 'l2' && (
        <div className="card" style={{ padding:'10px 14px', marginBottom: 12, background:'var(--blue-soft)', borderColor:'rgba(91,141,239,0.35)', display:'flex', alignItems:'center', gap: 10 }}>
          <Icon name="branch" size={13} style={{ color:'var(--blue-bright)' }}/>
          <div style={{ fontSize: 12 }}>
            <strong>Diff · {diff.label}</strong>
            <span style={{ color:'var(--text-dim)', marginLeft: 8 }}>{diff.note}</span>
          </div>
          <div style={{ display:'flex', gap: 6 }}>
            {diff.added.map(s   => <span key={s} className="chip green"  style={{ fontSize: 10 }}>+ {s}</span>)}
            {diff.modified.map(s=> <span key={s} className="chip amber"  style={{ fontSize: 10 }}>~ {s}</span>)}
            {diff.removed.map(s => <span key={s} className="chip red"    style={{ fontSize: 10 }}>− {s}</span>)}
          </div>
          <button className="btn sm ghost" onClick={() => setDiffId(null)}>Clear</button>
        </div>
      )}

      {/* Main split: canvas + aside */}
      <div style={{ display:'grid', gridTemplateColumns: selectedNode ? '1fr 380px' : '1fr', gap: 14, alignItems:'start' }}>
        <div className="card" style={{ padding: 18, position:'relative', overflow:'hidden' }}>
          <C4Canvas
            level={level}
            containerId={containerId}
            nodes={nodes}
            edges={edges}
            picked={picked}
            onPick={onPick}
            overlayWs={overlayWs}
            litSet={litSet}
            litEdges={litEdges}
            diff={diff}
            viewBox={VB}
          />

          {/* Legend */}
          <div style={{ position:'absolute', left: 16, bottom: 14, display:'flex', flexWrap:'wrap', gap: 14, fontSize: 10.5, color:'var(--text-dim)', background:'rgba(10,14,20,0.85)', backdropFilter:'blur(6px)', padding:'8px 12px', borderRadius: 4, border:'1px solid var(--line-soft)' }}>
            {overlayWs ? (
              <>
                <span style={{ color:'var(--text-mute)' }}>Workspace:</span>
                {Object.entries(WS_LABEL).map(([k, v]) => (
                  <span key={k} style={{ display:'flex', alignItems:'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: WS_TONE[k], opacity: 0.85 }}/>{v}
                  </span>
                ))}
                <span style={{ display:'flex', alignItems:'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: WS_TONE._shared }}/>Shared
                </span>
              </>
            ) : level === 'l1' ? (
              <>
                <span style={{ display:'flex', alignItems:'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius:'50%', background:'transparent', border:'1.4px solid #5B8DEF' }}/>Person</span>
                <span style={{ display:'flex', alignItems:'center', gap: 5 }}><span style={{ width: 12, height: 8, background:'transparent', border:'1.4px solid #5B8DEF', borderRadius: 2 }}/>System (drill in)</span>
                <span style={{ display:'flex', alignItems:'center', gap: 5 }}><span style={{ width: 12, height: 8, background:'transparent', border:'1.4px solid #94A3B8', borderRadius: 2 }}/>External</span>
              </>
            ) : (
              <>
                {[
                  { k:'web',     l:'Web/mobile' },
                  { k:'service', l:'Service' },
                  { k:'db',      l:'Database' },
                  { k:'queue',   l:'Queue / event bus' },
                  { k:'external-svc', l:'External (boundary)' },
                ].map(x => (
                  <span key={x.k} style={{ display:'flex', alignItems:'center', gap: 5 }}>
                    <span style={{ width: 12, height: 8, background:'transparent', border:`1.4px solid ${KIND_TONE[x.k].stroke}`, borderRadius: 2, borderStyle: KIND_TONE[x.k].dashed?'dashed':'solid' }}/>{x.l}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>

        {selectedNode && (
          <C4Aside
            node={selectedNode}
            level={level}
            navigate={navigate}
            onClose={() => setPicked(null)}
            onAgent={() => setAgentOpen(true)}
          />
        )}
      </div>

      {agentOpen && <AgentContextSheet onClose={() => setAgentOpen(false)} node={selectedNode} level={level} containerId={containerId}/>}
    </div>
  );
};

// ——— CANVAS ———

const C4Canvas = ({ level, containerId, nodes, edges, picked, onPick, overlayWs, litSet, litEdges, diff, viewBox }) => {
  // L3 has bigger nodes; L1/L2 smaller
  const W = 160, H = 64;
  return (
    <svg viewBox={viewBox} style={{ width:'100%', height: level === 'l3' ? 540 : 700, display:'block' }}>
      <defs>
        <marker id="c4-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#5B8DEF"/>
        </marker>
        <marker id="c4-arr-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#FBBF24"/>
        </marker>
        <pattern id="c4-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0F1620" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#c4-grid)"/>

      {/* Title in top-left */}
      <g>
        <text x="20" y="28" fontSize="11" fontFamily="JetBrains Mono" fill="#5C6779" style={{ textTransform:'uppercase' }}>{level === 'l1' ? '— C4 · Context' : level === 'l2' ? '— C4 · Container · Northwind Mutual' : `— C4 · Component · ${containerId}`}</text>
      </g>

      {/* Edges first */}
      {edges.map((e, i) => {
        const lit  = litEdges && litEdges.has(e.from + '→' + e.to);
        const dim  = (litSet && litSet.size > 0 && !lit);
        return <C4Edge key={i} {...e} lit={lit} dim={dim} allNodes={nodes} w={W} h={H}/>;
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const isShared = n.shared;
        const wsKey = WS_TONE[C4_OWNERS[n.ws]?.ws] ? C4_OWNERS[n.ws].ws : n.ws;
        // colour fill if cascade overlay
        const fillTone = overlayWs ? (isShared ? WS_TONE._shared : WS_TONE[wsKey]) : null;
        const lit = litSet && litSet.has(n.id);
        const dim = (litSet && litSet.size > 0 && !lit);
        // diff styling
        let diffRing = null;
        if (diff) {
          if (diff.added.includes(n.id))    diffRing = '#10B981';
          if (diff.modified.includes(n.id)) diffRing = '#F59E0B';
          if (diff.removed.includes(n.id))  diffRing = '#EF4444';
        }
        return (
          <g key={n.id}>
            {fillTone && n.kind !== 'person' && n.kind !== 'system' && (
              <rect x={n.x} y={n.y} width={W} height={H} rx="5" fill={fillTone} fillOpacity="0.13" stroke="none"/>
            )}
            {diffRing && (
              <rect x={n.x - 3} y={n.y - 3} width={W + 6} height={H + 6} rx="7" fill="none" stroke={diffRing} strokeWidth="1.6" strokeDasharray="3 3"/>
            )}
            <C4Node n={n} selected={picked === n.id} dim={dim} lit={lit} overlayWs={overlayWs} onPick={onPick} w={W} h={H}/>
          </g>
        );
      })}
    </svg>
  );
};

// ——— ASIDE ———

const C4Aside = ({ node, level, navigate, onClose, onAgent }) => {
  const det = C4_DETAIL[node.id];
  const isContainer = level === 'l2' && (det || node.tech);
  const canDrillIn  = isContainer && !!L3_BY_CONTAINER[node.id];

  return (
    <div className="card" style={{ padding: 18, position:'sticky', top: 12, maxHeight:'calc(100vh - 140px)', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
        <div>
          <div className="h-eyebrow">{level === 'l1' ? (node.kind === 'person' ? 'Person' : node.kind === 'system' ? 'System' : 'External system') : level === 'l2' ? 'Container' : 'Component'}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{node.label}</div>
          {node.tech && <div className="mono" style={{ fontSize: 11, color:'var(--text-mute)', marginTop: 2 }}>{node.tech}</div>}
        </div>
        <button className="btn sm ghost" onClick={onClose}><Icon name="x" size={11}/></button>
      </div>

      <p style={{ fontSize: 12.5, color:'var(--text-dim)', lineHeight: 1.55, margin:'6px 0 14px' }}>{node.desc}</p>

      {/* Health row */}
      {det && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Stat label="Health" value={
            <span style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <StatusDot kind={det.health}/>
              <span style={{ textTransform:'capitalize' }}>{det.health}</span>
            </span>
          }/>
          <Stat label="Availability (90d)" value={det.sla}/>
          <Stat label="Owners" value={det.owners.join(' · ')}/>
          <Stat label="Open incidents" value={det.incidents}/>
        </div>
      )}

      {/* Cascade ribbon */}
      {node.ws && (
        <div style={{ marginBottom: 14 }}>
          <div className="h-eyebrow" style={{ marginBottom: 6 }}>Cascade — source of ownership</div>
          <div style={{ display:'flex', alignItems:'center', gap: 6, flexWrap:'wrap', fontSize: 11.5 }}>
            <Pill tone="purple">Company · Northwind</Pill>
            <Icon name="chevron-right" size={9} style={{ color:'var(--text-faint)' }}/>
            <Pill>{C4_OWNERS[node.ws]?.domain || 'Domain'}</Pill>
            <Icon name="chevron-right" size={9} style={{ color:'var(--text-faint)' }}/>
            <span className="chip" style={{ background: WS_TONE[C4_OWNERS[node.ws]?.ws] + '22', borderColor: WS_TONE[C4_OWNERS[node.ws]?.ws] + '66', color:'#E5EAF2' }}>
              {WS_LABEL[C4_OWNERS[node.ws]?.ws]} <span style={{ opacity:.7 }}>(primary)</span>
            </span>
            {node.extraWs && node.extraWs.map(w => (
              <span key={w} className="chip" style={{ background: WS_TONE[w] + '18', borderColor: WS_TONE[w] + '55', color:'#E5EAF2' }}>
                {WS_LABEL[w]} <span style={{ opacity:.7 }}>(contrib)</span>
              </span>
            ))}
          </div>
          {det && det.note && <div style={{ fontSize: 11, color:'#FCD34D', marginTop: 6 }}>{det.note}</div>}
        </div>
      )}

      {/* Linked artifacts */}
      {det && (
        <div style={{ display:'grid', gap: 10, marginBottom: 14 }}>
          <LinkRow label="Specs"      items={det.specs}    icon="doc"   onClick={(s) => navigate(`/spec/${s}`)}/>
          <LinkRow label="ADRs"       items={det.adrs}     icon="commit"/>
          <LinkRow label="Processes"  items={det.processes} icon="layers" onClick={() => navigate('/organisation/company/processes')}/>
          <LinkRow label="Glossary"   items={det.terms}    icon="list"  onClick={() => navigate('/organisation/company/glossary')}/>
        </div>
      )}

      <div style={{ display:'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop:'1px solid var(--line-soft)' }}>
        {canDrillIn && (
          <Btn icon="arrow-right" variant="primary" size="sm" onClick={() => navigate(`/organisation/company/c4/l3/${node.id}`)}>Drill into components</Btn>
        )}
        {node.kind === 'system' && level === 'l1' && (
          <Btn icon="arrow-right" variant="primary" size="sm" onClick={() => navigate('/organisation/company/c4/l2')}>Open containers</Btn>
        )}
        {C4_OWNERS[node.ws] && (
          <Btn size="sm" icon="cube" onClick={() => navigate(`/workspace/${C4_OWNERS[node.ws].ws}`)}>Open workspace</Btn>
        )}
        <div style={{ flex:1 }}/>
        <Btn size="sm" icon="sparkle" onClick={onAgent}>Agent context</Btn>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div style={{ background:'var(--bg)', border:'1px solid var(--line-soft)', borderRadius: 4, padding:'8px 10px' }}>
    <div className="h-eyebrow" style={{ marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 12.5 }}>{value}</div>
  </div>
);

const LinkRow = ({ label, items, icon, onClick }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="h-eyebrow" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap: 4 }}>
        {items.map(s => (
          <span key={s} className="chip mono" style={{ fontSize: 10.5, cursor: onClick ? 'pointer' : 'default' }} onClick={() => onClick && onClick(s)}>
            <Icon name={icon} size={10}/>{s}
          </span>
        ))}
      </div>
    </div>
  );
};

// ——— AGENT CONTEXT SHEET ———

const AgentContextSheet = ({ onClose, node, level, containerId }) => {
  const target = node ? node.label : (level === 'l3' ? containerId : 'system');
  const lines = [
    `# Agent context — ${target}`,
    `Compiled ${new Date().toISOString().slice(0,16).replace('T',' ')}Z`,
    ``,
    `## Cascade (top → bottom)`,
    `- Company: Northwind Mutual`,
    node ? `- Domain: ${C4_OWNERS[node.ws]?.domain || '—'}`   : `- Domain: (multiple)`,
    node ? `- Workspace: ${WS_LABEL[C4_OWNERS[node.ws]?.ws] || '—'}` : `- Workspace: (multiple)`,
    node ? `- Container: ${node.label}` : `- Container: (multiple)`,
    ``,
    `## What you can rely on`,
    `- Identity through identity-svc (CHID hashing — see Glossary)`,
    `- Audit through audit-trail-svc (see SPEC-049)`,
    `- Event backbone Kafka cluster (platform)`,
    ``,
    `## Tech context`,
    node && node.tech ? `- Stack: ${node.tech}` : `- Stack: see container details`,
    `- Logs: Datadog (filter \`service:${node ? node.id : '*'}\`)`,
    `- Runbooks: /wiki/runbooks/${node ? node.id : 'index'}`,
    ``,
    `## Linked artefacts`,
    ...(node && C4_DETAIL[node.id]?.specs.map(s => `- Spec: ${s}`)        || []),
    ...(node && C4_DETAIL[node.id]?.adrs.map(s => `- ADR: ${s}`)          || []),
    ...(node && C4_DETAIL[node.id]?.processes.map(s => `- Process: ${s}`) || []),
    ...(node && C4_DETAIL[node.id]?.terms.map(s => `- Term: ${s}`)        || []),
    ``,
    `## Constraints (inherited)`,
    `- GDPR Art.17 — see COM-GDPR doc`,
    `- PCI scope minimisation — see COM-PCI doc`,
    `- All writes must emit to audit-trail (see SEC-BASE)`,
    ``,
    `## Drift / known issues`,
    node && C4_DETAIL[node.id]?.note ? `- ${C4_DETAIL[node.id].note}` : `- None reported.`,
  ].join('\n');

  return (
    <div style={{ position:'fixed', inset: 0, zIndex: 200, background:'rgba(2,6,12,0.55)', backdropFilter:'blur(2px)', display:'flex', justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ width: 560, background:'var(--surface)', borderLeft:'1px solid var(--line)', padding:'18px 22px', overflow:'auto', boxShadow:'-12px 0 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
            <Icon name="sparkle" size={14} style={{ color:'var(--purple)' }}/>
            <h3 style={{ margin:0, fontSize: 14.5, fontWeight: 600 }}>Agent context bundle</h3>
            <span className="chip" style={{ fontSize: 10 }}>copy → paste into Spec Agent</span>
          </div>
          <button className="btn sm ghost" onClick={onClose}><Icon name="x" size={11}/></button>
        </div>
        <div style={{ fontSize: 11.5, color:'var(--text-mute)', marginBottom: 10 }}>
          Everything an agent needs to reason about <strong style={{ color:'var(--text)' }}>{target}</strong>: cascade, owners, tech, linked specs/ADRs/processes/terms, inherited constraints, and drift.
        </div>
        <pre className="mono" style={{ background:'var(--bg)', border:'1px solid var(--line-soft)', borderRadius: 4, padding: 14, fontSize: 11.5, lineHeight: 1.6, color:'var(--text-dim)', whiteSpace:'pre-wrap', margin: 0 }}>{lines}</pre>
        <div style={{ display:'flex', gap: 6, marginTop: 12 }}>
          <Btn icon="check" variant="primary" size="sm">Copy to clipboard</Btn>
          <Btn icon="sparkle" size="sm">Open in Spec Agent</Btn>
          <Btn icon="download" size="sm">.md</Btn>
        </div>
      </div>
    </div>
  );
};

window.C4Explorer = C4Explorer;

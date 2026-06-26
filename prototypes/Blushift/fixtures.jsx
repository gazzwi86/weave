/* global React */

window.FIXTURES = {
  org: {
    name: 'Northwind Financial',
    domains: 5, services: 77, stakeholders: 47, capabilities: 41,
  },
  user: { name: 'Jamie Reeves', email: 'jamie@northwind.fin', initials: 'JR' },

  workspaces: [
    {
      id: 'customer-portal',
      name: 'Customer Portal',
      domain: 'customer',
      icon: 'cube',
      hue: 210,
      description: 'Self-service portal experiences, identity, profile, and consent surfaces.',
      lead: { name:'Sarah Chen', initials:'SC' },
      contributors: [{n:'Sarah Chen',i:'SC'},{n:'Emma Vasquez',i:'EV'},{n:'Tomás Reyes',i:'TR'},{n:'Priya Iyer',i:'PI'}],
      projects: 4, specs: 7, wikiPages: 38, openPolaris: 3,
      health: 'green',
      activitySpark: [3,4,2,5,7,6,8,9,7,8],
      lastActive: '4 min ago',
    },
    {
      id: 'fraud-and-claims',
      name: 'Fraud & Claims Intelligence',
      domain: 'claims',
      icon: 'shield-check',
      hue: 25,
      description: 'Adjudication, fraud scoring, and triage automation for the claims pipeline.',
      lead: { name:'Maya Patel', initials:'MP' },
      contributors: [{n:'Maya Patel',i:'MP'},{n:'Robin Lee',i:'RL'},{n:'Idris Khan',i:'IK'}],
      projects: 3, specs: 5, wikiPages: 24, openPolaris: 2,
      health: 'amber',
      activitySpark: [5,3,4,2,3,5,4,6,4,5],
      lastActive: '22 min ago',
    },
    {
      id: 'lending-data',
      name: 'Lending Data Platform',
      domain: 'lending',
      icon: 'graph',
      hue: 160,
      description: 'Loan ledger, decisioning, and the analytics ingestion fabric for lending.',
      lead: { name:'Chris Okafor', initials:'CO' },
      contributors: [{n:'Chris Okafor',i:'CO'},{n:'Anya Volkov',i:'AV'},{n:'Wes Mathieu',i:'WM'},{n:'Lila Park',i:'LP'},{n:'Nour Bey',i:'NB'}],
      projects: 5, specs: 9, wikiPages: 51, openPolaris: 4,
      health: 'green',
      activitySpark: [6,7,8,7,9,8,7,9,8,9],
      lastActive: '1h ago',
    },
    {
      id: 'policy-underwriting',
      name: 'Policy & Underwriting',
      domain: 'policy',
      icon: 'doc',
      hue: 270,
      description: 'Quote, underwriting, renewals, and policy document generation.',
      lead: { name:'Aleks Marek', initials:'AM' },
      contributors: [{n:'Aleks Marek',i:'AM'},{n:'Yuki Tanaka',i:'YT'},{n:'Kirk Iliescu',i:'KI'}],
      projects: 2, specs: 4, wikiPages: 29, openPolaris: 1,
      health: 'green',
      activitySpark: [2,3,4,3,4,5,4,5,4,5],
      lastActive: '3h ago',
    },
    {
      id: 'platform-foundations',
      name: 'Platform Foundations',
      domain: 'platform',
      icon: 'layers',
      hue: 195,
      description: 'Auth, event bus, observability, sandbox, secrets, and CI/CD substrate.',
      lead: { name:'Alex Tomic', initials:'AT' },
      contributors: [{n:'Alex Tomic',i:'AT'},{n:'Devi Rao',i:'DR'},{n:'Bram Holt',i:'BH'},{n:'Jules Park',i:'JP'},{n:'Mira Sól',i:'MS'},{n:'Owen Tate',i:'OT'}],
      projects: 6, specs: 11, wikiPages: 72, openPolaris: 5,
      health: 'green',
      activitySpark: [8,9,7,8,9,8,9,9,8,10],
      lastActive: '12 min ago',
    },
    {
      id: 'data-and-ml',
      name: 'Data & ML',
      domain: 'data',
      icon: 'graph',
      hue: 325,
      description: 'Lakehouse, feature store, model registry, and ML serving infrastructure.',
      lead: { name:'Jordan Kemp', initials:'JK' },
      contributors: [{n:'Jordan Kemp',i:'JK'},{n:'Elena Briggs',i:'EB'},{n:'Sam Otieno',i:'SO'}],
      projects: 3, specs: 6, wikiPages: 33, openPolaris: 2,
      health: 'amber',
      activitySpark: [4,3,5,4,5,4,3,5,4,4],
      lastActive: '6h ago',
    },
  ],

  // Map projects → workspaces
  projects: [
    {
      id: 'csp-v2',
      workspace: 'customer-portal',
      name: 'Customer self-service portal v2',
      stack: 'Next.js + BFF',
      phase: 'Wave 1: Implementation',
      phasePct: 78,
      demo: { status: 'green', label: 'Last demo: 2h ago' },
      budget: { used: 1847, cap: 3000 },
      owner: { name: 'Sarah Chen', initials: 'SC', color: '#3B82F6' },
    },
    {
      id: 'fraud-uplift',
      workspace: 'fraud-and-claims',
      name: 'Fraud-scorer model uplift',
      stack: 'Python ML',
      phase: 'Wave 0: Spec review',
      phasePct: 12,
      demo: { status: 'amber', label: 'No demo yet' },
      budget: { used: 312, cap: 4500 },
      owner: { name: 'Maya Patel', initials: 'MP', color: '#8B5CF6' },
    },
    {
      id: 'snowflake-ingest',
      workspace: 'lending-data',
      name: 'Lending Snowflake ingestion',
      stack: 'Event-driven data',
      phase: 'Wave 1: Implementation',
      phasePct: 45,
      demo: { status: 'green', label: 'Last pipeline: 6h' },
      budget: { used: 923, cap: 2200 },
      owner: { name: 'Chris Okafor', initials: 'CO', color: '#10B981' },
    },
  ],

  polaris: [
    {
      id: 'P-2026-05-08-014',
      title: 'Add font preconnect to onboarding-flow <head> to reduce FOUT',
      time: '4 hours ago',
      tags: ['HIGH IMPACT', 'PROJECT-LEVEL'],
      project: 'csp-v2',
      evidence: [
        '3 visual-fidelity rubric scores below threshold last 2wk',
        'F25 visual capture shows >300ms FOUT vs DESIGN.md baseline',
        '2 escalations cite "fonts not loading in time"',
        '5 similar projects in pattern repo all use preconnect',
      ],
      rationale: 'The DESIGN.md font-loading section specifies preconnect for Fraunces serif. The onboarding-flow\'s index.html is missing the <link rel="preconnect"> tag. Adding it should bring FOUT under threshold.',
      metrics: [
        { name: 'Visual fidelity rubric', delta: '+0.6 (estimated)' },
        { name: 'F25 font-loaded assertion', delta: '73% → ≥95%' },
      ],
      action: 'Dispatch Engineer agent → add preconnect → run F25 → confirm → commit',
    },
    {
      id: 'P-2026-05-07-022',
      title: 'Cache /api/portfolio response at edge — saves ~$180/mo in DB cost',
      time: '1 day ago',
      tags: ['MEDIUM IMPACT', 'PROJECT-LEVEL'],
      project: 'csp-v2',
      evidence: [
        'p95 latency 412ms — 4.2x above SLO',
        'Datadog: 92% of requests are read-only and idempotent',
        'No cache headers set in BFF response',
        'Edge cache hit ratio could reach 88% based on traffic profile',
      ],
      rationale: 'Portfolio data is read-heavy and changes <1/min. Add `Cache-Control: s-maxage=60, stale-while-revalidate=120` and align ETags. Estimated DB load -38%.',
      metrics: [
        { name: 'p95 latency', delta: '412ms → ~95ms' },
        { name: 'Monthly DB cost', delta: '−$180' },
      ],
      action: 'Dispatch Engineer → set cache headers → load test → ship',
    },
    {
      id: 'P-2026-05-06-008',
      title: 'Promote Adjudication capability to org graph (currently inferred)',
      time: '2 days ago',
      tags: ['HIGH IMPACT', 'ORG-LEVEL'],
      project: null,
      evidence: [
        '4 services already implement adjudication semantics',
        'Wiki references appear in 11 places — no canonical owner',
        'Recent Snappy Request flagged absence',
        'Confluence has 3 conflicting definitions',
      ],
      rationale: 'Adjudication is repeatedly invoked across Claims and Lending but has no graph node. Promoting it formalises ownership and unblocks future programmes.',
      metrics: [
        { name: 'Capability coverage', delta: '40 → 41' },
        { name: 'Stakeholder clarity', delta: '+1 RACI owner' },
      ],
      action: 'Dispatch Architect → propose ADR → Council review → graph mutation',
    },
    {
      id: 'P-2026-05-05-031',
      title: 'Replace ad-hoc retry loops in fraud-scorer with circuit breaker',
      time: '3 days ago',
      tags: ['MEDIUM IMPACT', 'PROJECT-LEVEL'],
      project: 'fraud-uplift',
      evidence: [
        '6 incidents trace to retry storms',
        'No backoff on 3 critical paths',
        'Existing CB library available in platform-common',
      ],
      rationale: 'Standardise on platform-common circuit breaker for all outbound calls in fraud-scorer.',
      metrics: [
        { name: 'Retry-induced load', delta: '−72%' },
        { name: 'MTTR for downstream blip', delta: '4m → 35s' },
      ],
      action: 'Dispatch Engineer → wrap calls → unit tests → chaos drill',
    },
    {
      id: 'P-2026-05-05-027',
      title: 'Write missing ADR-014 for the Kafka topic schema versioning policy',
      time: '3 days ago',
      tags: ['LOW IMPACT', 'PROJECT-LEVEL'],
      project: 'snowflake-ingest',
      evidence: [
        '3 services consume the topic with divergent assumptions',
        '1 incident traced to schema drift',
        'No record of decision in /decisions',
      ],
      rationale: 'Capture the implicit policy as ADR-014 to prevent future drift.',
      metrics: [{ name: 'Decision coverage', delta: '+1 ADR' }],
      action: 'Dispatch Tech-Writer → draft ADR → council review',
    },
    {
      id: 'P-2026-05-04-019',
      title: 'Consolidate three duplicate auth helpers into platform-common/auth',
      time: '4 days ago',
      tags: ['MEDIUM IMPACT', 'ORG-LEVEL'],
      project: null,
      evidence: [
        '3 implementations across 11 services',
        '2 CVEs patched in only one — others vulnerable',
        'Diff shows logic is 92% identical',
      ],
      rationale: 'Unify behind one library with a single security review surface.',
      metrics: [
        { name: 'Vulnerable services', delta: '7 → 0' },
        { name: 'LOC duplicated', delta: '−2,140' },
      ],
      action: 'Dispatch Architect → propose API → Engineer migrates services',
    },
  ],

  notifications: [
    { kind: 'red',    icon: '🔴', text: 'CI red on main',                     project: 'Customer self-service portal v2', time: '12 min ago', cta: 'view PR' },
    { kind: 'amber',  icon: '🟡', text: 'Budget at 75%',                      project: 'Fraud-scorer model uplift',       time: '1 hour ago', cta: 'view budget' },
    { kind: 'green',  icon: '🟢', text: 'Phase ready for review',             project: 'Lending Snowflake ingestion — Wave 1', time: '3 hours ago', cta: 'review phase' },
    { kind: 'purple', icon: '🟣', text: 'Polaris proposal — Add font preconnect', project: 'Customer self-service portal v2', time: '4 hours ago', cta: 'view proposal' },
    { kind: 'red',    icon: '⛔', text: 'Sandbox blocked — write to ~/.kube/config in TASK-019', project: 'Customer self-service portal v2', time: '6 hours ago', cta: 'audit log' },
    { kind: 'green',  icon: '🟢', text: 'Demo ready',                          project: 'Customer self-service portal v2', time: '8 hours ago', cta: 'view demo' },
    { kind: 'amber',  icon: '🟡', text: 'Visual fidelity below threshold (TASK-024)', project: 'Customer self-service portal v2', time: '10 hours ago', cta: 'view task' },
    { kind: 'green',  icon: '🟢', text: 'Phase gate passed — Wave 0 complete', project: 'Lending Snowflake ingestion', time: '1 day ago', cta: 'view audit' },
    { kind: 'purple', icon: '🟣', text: 'Polaris proposal — Cache /api/portfolio at edge', project: 'Customer self-service portal v2', time: '1 day ago', cta: 'view proposal' },
    { kind: 'green',  icon: '🟢', text: 'Audit chain re-verified clean',       project: 'Org', time: '1 day ago', cta: 'view audit' },
  ],

  activity: [
    { who: 'Engineer agent',     what: 'committed', target: 'src/components/CheckoutSummary.tsx', project: 'Customer self-service portal v2', time: '4 min ago',  hash: 'a1b2c3d' },
    { who: 'QA agent',           what: 'validated', target: 'TASK-022-promo-code-flow', project: 'Customer self-service portal v2', time: '18 min ago', hash: null },
    { who: 'Polaris',            what: 'opened proposal', target: 'P-2026-05-08-014', project: 'Customer self-service portal v2', time: '4h ago', hash: null },
    { who: 'Engineer agent',     what: 'escalated', target: 'TASK-024 (3 retries)', project: 'Customer self-service portal v2', time: '47 min ago', hash: null },
    { who: 'Sarah Chen',         what: 'approved phase gate', target: 'Wave 1: Implementation kick-off', project: 'Customer self-service portal v2', time: '6h ago', hash: null },
    { who: 'Code Reviewer',      what: 'requested changes on', target: 'PR #284', project: 'Customer self-service portal v2', time: '6h ago', hash: null },
    { who: 'Architect agent',    what: 'proposed ADR-013', target: 'Edge caching strategy', project: 'Customer self-service portal v2', time: '8h ago', hash: null },
    { who: 'Tech-Writer agent',  what: 'updated wiki page', target: '/customer/portal-bff/overview', project: 'Customer self-service portal v2', time: '12h ago', hash: null },
    { who: 'Maya Patel',         what: 'opened Snappy Request', target: 'Motor Fast-Track Claims Service', project: 'Org', time: '1d ago', hash: null },
    { who: 'Engineer agent',     what: 'committed', target: 'fraud-scorer/features.py', project: 'Fraud-scorer model uplift', time: '1d ago', hash: 'e4f5g6h' },
  ],

  tasks: {
    inFlight: [
      { id: 'TASK-024', title: 'Checkout summary page',  agent: 'Engineer',     state: 'retry',   meta: 'retry 1 of 3, 47 min', highlight: true },
      { id: 'TASK-025', title: 'Confirmation banner',    agent: 'Engineer',     state: 'running', meta: 'just started' },
      { id: 'TASK-022', title: 'Promo code flow',        agent: 'QA',           state: 'qa',      meta: 'validating' },
      { id: 'TASK-021', title: 'Sidebar collapse',       agent: 'Code Reviewer',state: 'review',  meta: 'reviewing' },
    ],
  },

  kanban: {
    Backlog: [
      { id:'TASK-031', title:'Empty cart state',       agent:'E', t:'—' },
      { id:'TASK-032', title:'Wishlist nav entry',     agent:'E', t:'—' },
      { id:'TASK-033', title:'Address autocomplete',   agent:'E', t:'—' },
      { id:'TASK-034', title:'Saved cards mgmt',       agent:'E', t:'—' },
      { id:'TASK-035', title:'Apple Pay button',       agent:'E', t:'—' },
    ],
    Ready: [
      { id:'TASK-026', title:'Tax breakdown row',      agent:'E', t:'—' },
      { id:'TASK-027', title:'Order item thumbnails',  agent:'E', t:'—' },
      { id:'TASK-028', title:'Coupon stacking rules',  agent:'E', t:'—' },
      { id:'TASK-029', title:'PII redact on receipt',  agent:'E', t:'—' },
    ],
    'In progress': [
      { id:'TASK-024', title:'Checkout summary page',  agent:'E', t:'47m', active:true, retry:true },
      { id:'TASK-025', title:'Confirmation banner',    agent:'E', t:'2m' },
      { id:'TASK-030', title:'Loading skeletons',      agent:'E', t:'12m' },
    ],
    Review: [
      { id:'TASK-022', title:'Promo code flow',        agent:'Q', t:'8m' },
      { id:'TASK-021', title:'Sidebar collapse',       agent:'R', t:'14m' },
      { id:'TASK-023', title:'Header search a11y',     agent:'Q', t:'21m' },
    ],
    Done: [
      { id:'TASK-018', title:'Cart drawer transitions',agent:'E', t:'1h' },
      { id:'TASK-017', title:'Quantity stepper a11y',  agent:'E', t:'2h' },
      { id:'TASK-016', title:'Toast system',           agent:'E', t:'4h' },
      { id:'TASK-015', title:'Theme tokens import',    agent:'E', t:'5h' },
      { id:'TASK-014', title:'Footer skeleton',        agent:'E', t:'7h' },
    ],
    'Phase complete': [
      { id:'TASK-001..013', title:'Wave 0 spec & design (13 tasks)', agent:'•', t:'closed' },
    ],
  },

  taskBrief: {
    id: 'TASK-024',
    title: 'Checkout summary page',
    yaml: `task: TASK-024-checkout-summary-page
project: csp-v2
phase: wave-1-implementation

acceptance:
  - Renders order summary with line items, tax, total
  - Honors locale-specific currency formatting
  - Supports promo-code field with live validation
  - Shows estimated delivery window from BFF /shipping
  - Persists scroll position across hydration

design_tokens:
  - color.surface.raised        # → DESIGN.md#L142
  - color.text.primary           # → DESIGN.md#L88
  - radius.card                  # → DESIGN.md#L201
  - shadow.elevation-1           # → DESIGN.md#L233
  - typography.body.regular      # → DESIGN.md#L60
  - spacing.scale.4              # → DESIGN.md#L24

pixel_constraints:
  max_width: 720
  min_tap_target: 44
  line_height_min: 1.45
  contrast_min_AA: 4.5

forbidden_inferences:
  - DO NOT invent new color tokens — use design_tokens only
  - DO NOT hard-code currency symbols — use Intl.NumberFormat
  - DO NOT auto-submit on Enter in promo field

required_diagrams:
  - mermaid_state: form (idle|validating|submitting|error|success)`,
  },

  audit: {
    chainEntries: 4712,
    lastVerified: '5 min ago',
    entries: [
      { n: 4712, t: '2026-05-08T15:42:18Z', op: 'Edit', target: 'src/components/Bubble.tsx',  meta: 'sandbox passed • scrubber clean • signed ✓' },
      { n: 4711, t: '2026-05-08T15:41:55Z', op: 'Read', target: 'src/components/Cart.tsx',    meta: 'sandbox passed • signed ✓' },
      { n: 4710, t: '2026-05-08T15:41:30Z', op: 'Bash', target: 'pnpm test --filter checkout',meta: 'exit 0 • 12.4s • signed ✓' },
      { n: 4709, t: '2026-05-08T15:39:02Z', op: 'Edit', target: 'src/lib/intl.ts',            meta: 'sandbox passed • scrubber clean • signed ✓' },
      { n: 4708, t: '2026-05-08T15:38:44Z', op: 'Read', target: 'DESIGN.md',                  meta: 'signed ✓' },
      { n: 4707, t: '2026-05-08T15:37:11Z', op: 'Write',target: 'src/components/Promo.tsx',   meta: 'sandbox passed • scrubber clean • signed ✓' },
      { n: 4706, t: '2026-05-08T15:35:50Z', op: 'Bash', target: 'git status',                 meta: 'exit 0 • signed ✓' },
      { n: 4705, t: '2026-05-08T15:34:02Z', op: 'Edit', target: 'src/components/Order.tsx',   meta: 'sandbox passed • scrubber clean • signed ✓' },
      { n: 4704, t: '2026-05-08T15:32:18Z', op: 'Block',target: '~/.kube/config',             meta: 'sandbox BLOCKED • write to protected path • signed ✓', flag:'red' },
      { n: 4703, t: '2026-05-08T15:30:55Z', op: 'Read', target: 'progress.json',              meta: 'signed ✓' },
      { n: 4702, t: '2026-05-08T15:29:01Z', op: 'Edit', target: 'src/lib/format.ts',          meta: 'sandbox passed • signed ✓' },
      { n: 4701, t: '2026-05-08T15:27:44Z', op: 'Bash', target: 'pnpm typecheck',             meta: 'exit 0 • 3.1s • signed ✓' },
      { n: 4700, t: '2026-05-08T15:25:30Z', op: 'Edit', target: 'src/components/Checkout.tsx',meta: 'sandbox passed • scrubber clean • signed ✓' },
      { n: 4699, t: '2026-05-08T15:23:18Z', op: 'Read', target: 'src/components/Checkout.tsx',meta: 'signed ✓' },
      { n: 4698, t: '2026-05-08T15:21:02Z', op: 'Write',target: 'tests/checkout.spec.ts',     meta: 'sandbox passed • signed ✓' },
    ],
  },
};

window.fmt = {
  money: (n) => '$' + n.toLocaleString(),
  pct: (a, b) => Math.round((a / b) * 100) + '%',
};

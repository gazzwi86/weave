/** `en` catalogue -- every user-facing string in the M1 onboarding content lives here (ADR-006). */
export const en: Record<string, string> = {
  // Tour: Constitution overview.
  "onboarding.tour.ce-overview.step1.title": "Welcome to the graph",
  "onboarding.tour.ce-overview.step1.body":
    "This is your entity list -- every person, process, system, and rule your company runs on, in one place.",
  "onboarding.tour.ce-overview.step2.title": "Search and filter",
  "onboarding.tour.ce-overview.step2.body":
    "Use the glossary to look up any term and see exactly how it connects to everything else.",
  "onboarding.tour.ce-overview.step3.title": "Ask a question",
  "onboarding.tour.ce-overview.step3.body":
    "Query in plain English or raw SPARQL -- both land on the same live graph, so answers are always current.",
  "onboarding.tour.ce-overview.step4.title": "Rules keep it honest",
  "onboarding.tour.ce-overview.step4.body":
    "Every change is checked against your rules before it lands, so the graph never drifts from reality.",
  // Tour: Explorer canvas.
  "onboarding.tour.ge-canvas.step1.title": "See the shape of your business",
  "onboarding.tour.ge-canvas.step1.body":
    "The canvas draws every relationship as a line -- zoom, pan, and click any node for detail.",
  "onboarding.tour.ge-canvas.step2.title": "Spotlight what matters",
  "onboarding.tour.ge-canvas.step2.body":
    "Spotlight highlights one entity and its neighbours, fading the rest -- the fastest way to trace an impact.",
  // Beacon copy.
  "onboarding.beacon.ce-versions.body":
    "Every commit is versioned -- open this panel any time to see who changed what, and diff it against any prior version.",
  // Welcome modals.
  "onboarding.modal.constitution.title": "Welcome to Constitution",
  "onboarding.modal.constitution.body": "This is where your company's knowledge graph lives. Take a quick tour?",
  "onboarding.modal.explorer.title": "Welcome to Explorer",
  "onboarding.modal.explorer.body": "See your whole business as a graph. Take a quick tour?",
  "onboarding.modal.compliance.title": "Welcome to Compliance",
  "onboarding.modal.compliance.body": "Governance and audit trails live here -- browse freely, no tour needed yet.",
  "onboarding.modal.settings.title": "Welcome to Settings",
  "onboarding.modal.settings.body": "Manage your workspace and models here -- browse freely, no tour needed yet.",
  "onboarding.cta.take-a-tour": "Take a tour",
  "onboarding.cta.explore-freely": "Explore freely",
  "onboarding.cta.read-the-guide": "Read the guide",
  "onboarding.beacon.learn-more": "Learn more",
  "onboarding.beacon.dismiss": "Got it",
  "onboarding.beacon.show-all-hints": "Show all hints",
  "onboarding.modal.dismiss": "Got it",
  // Exercises.
  "onboarding.exercise.ce-01.goal": "Find an entity and open its detail page.",
  "onboarding.exercise.ce-01.step1": "Open the entity list.",
  "onboarding.exercise.ce-01.step2": "Search for any entity by name.",
  "onboarding.exercise.ce-01.step3": "Open its detail page.",
  "onboarding.exercise.ce-02.goal": "Ask a plain-English question about the graph.",
  "onboarding.exercise.ce-02.step1": "Open Query.",
  "onboarding.exercise.ce-02.step2": "Type a question in plain English.",
  "onboarding.exercise.ce-02.step3": "Read the answer and its source entities.",
  "onboarding.exercise.ce-03.goal": "Write a raw SPARQL SELECT against the sandbox graph.",
  "onboarding.exercise.ce-03.step1": "Open Query and switch to SPARQL mode.",
  "onboarding.exercise.ce-03.step2": "Write a SELECT over the sandbox graph.",
  "onboarding.exercise.ce-03.step3": "Run it and confirm rows return.",
  "onboarding.exercise.ce-03b.goal": "Commit a small change and see it take effect.",
  "onboarding.exercise.ce-03b.step1": "Open any entity you own.",
  "onboarding.exercise.ce-03b.step2": "Edit one field.",
  "onboarding.exercise.ce-03b.step3": "Commit the change.",
  "onboarding.exercise.ge-01.goal": "Open the canvas and spotlight one entity.",
  "onboarding.exercise.ge-01.step1": "Open Explorer.",
  "onboarding.exercise.ge-01.step2": "Click any node.",
  "onboarding.exercise.ge-01.step3": "Turn on spotlight.",
  "onboarding.exercise.ge-02.goal": "Trace a relationship two hops out.",
  "onboarding.exercise.ge-02.step1": "Pick a starting entity.",
  "onboarding.exercise.ge-02.step2": "Follow a connecting line.",
  "onboarding.exercise.ge-02.step3": "Follow one more hop and note what you find.",
  // Checklist.
  "onboarding.checklist.visit-demo.label": "Visit the demo workspace",
  "onboarding.checklist.visit-demo.why": "See real data before you commit your own.",
  "onboarding.checklist.first-query.label": "Run your first query",
  "onboarding.checklist.first-query.why": "Queries are how you'll answer real questions later.",
  "onboarding.checklist.first-commit.label": "Make your first commit",
  "onboarding.checklist.first-commit.why": "Committing is how changes become part of the graph.",
  "onboarding.checklist.explore-canvas.label": "Explore the graph canvas",
  "onboarding.checklist.explore-canvas.why": "The canvas shows how everything connects at a glance.",
  // Training.
  "onboarding.training.getting-started.title": "Getting started with Weave",
  "onboarding.training.getting-started.description":
    "A short walkthrough of the graph, the query tools, and your first commit.",
  "onboarding.training.explorer-basics.title": "Explorer basics",
  "onboarding.training.explorer-basics.description": "Navigate the canvas, spotlight, and trace relationships.",
  "onboarding.training.getting-started.walkthrough": "Read the walkthrough",
  "onboarding.training.getting-started.walkthrough-body":
    "Step through the graph, run your first query, and make your first commit -- at your own pace.",
  "onboarding.training.category.introduction": "Introduction",
  "onboarding.training.category.ontologies": "Ontologies",
  "onboarding.training.category.graph-explorer": "Graph Explorer",
  "onboarding.training.category.build": "Build",
  "onboarding.training.category.automation": "Automation",
  "onboarding.training.category.compliance-governance": "Compliance & Governance",
  "onboarding.training.category.administration": "Administration",
  "onboarding.training.category-post-v1-flag": "Available when this engine ships",
  "onboarding.training.video-coming-soon": "Video — coming soon",
  "onboarding.training.video-error": "Couldn't load this video. Try again later.",
  "onboarding.training.search-label": "Search training",
  "onboarding.training.search-placeholder": "Search videos and walkthroughs...",
  "onboarding.training.empty": "No training content matches your search.",
  // What's new.
  "onboarding.whats-new.launch.title": "Weave is here",
  "onboarding.whats-new.launch.body": "Your company's knowledge graph, live and queryable from day one.",
  "onboarding.whats-new.empty": "Nothing new to report right now.",
  "onboarding.whats-new.heading": "What's new",
  // Test-only fixtures (unit-test-local content) -- never referenced by real content.
  "x.body": "A short body well within budget.",
  "onboarding.fixture.over-budget-tour": Array(41).fill("word").join(" "),
  "onboarding.fixture.over-budget-beacon": Array(61).fill("word").join(" "),
};

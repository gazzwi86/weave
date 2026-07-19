"""Static demo content for `db/seed_demo.py`: tenant SHACL shapes, standards
docs, and the Build project's epics/tasks. Split from `DEMO_OPS` (see
`seed_demo_graph.py`) for Law E's file-length budget -- pure data, no logic.
"""

from __future__ import annotations

#: Deliverable 3: 3 tenant SHACL shapes (Activity/Actor/Process), each
#: requiring `weave:description` at `sh:Violation` -- the framework ships
#: `weave:description` on Activity at `sh:Warning` only (never blocking),
#: so these are what actually turn a missing description into a 422,
#: grounded in Hammerbarn's own audit/onboarding need for every process
#: doc to explain itself. Every predicate used (`description`) is on the
#: known-predicate list `authoring/shapes.py::parse_raw_shape` gates
#: against (ontology-standards.md).
SHAPE_TTL_TEMPLATE = """
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology/> .
<{iri}> a sh:NodeShape ;
    sh:targetClass weave:{target} ;
    sh:property [
        sh:path weave:description ;
        sh:minCount 1 ;
        sh:severity sh:Violation ;
        sh:message "{message}"@en ;
    ] .
"""

TENANT_SHAPES = (
    (
        "https://weave.io/instances/shape-hammerbarn-activity-description",
        "Activity",
        "Every Activity must document what it does, for audit and onboarding.",
    ),
    (
        "https://weave.io/instances/shape-hammerbarn-actor-description",
        "Actor",
        "Every Actor must document its role, for audit and onboarding.",
    ),
    (
        "https://weave.io/instances/shape-hammerbarn-process-description",
        "Process",
        "Every Process must document what it does and why, for audit and onboarding.",
    ),
)


#: Deliverable 2 (relational half): 2 `standards_documents` rows, cross-
#: linked via `policy_iri` to the `BrandStandard` individuals `DEMO_OPS`
#: already minted into the graph (a real IRI, not a placeholder string).
STANDARDS_DOCS = (
    (
        "brand-voice-guide",
        "Brand Voice Guide",
        "# Tone of Voice\n\nHammerbarn speaks like the trade professional "
        "behind the counter: direct, warm, no fluff.",
        "brand-standard-voice",
    ),
    (
        "logo-usage-policy",
        "Logo Usage Policy",
        "# Logo Usage\n\nSee the linked brand asset library for approved "
        "logo lockups and clear-space rules.",
        "brand-standard-logo",
    ),
)


#: Deliverable 4: 3 epics' worth of tasks (epic_id, epic_title, title,
#: status), spread across every real kanban lane (`build.board.LANE_OF_
#: STATUS`: Queued->Backlog, Ready->Ready, Blocked->Review, revision->QA,
#: Done->Done) so the Dashboard/Kanban/Roadmap tabs have something to show.
BUILD_PROJECT_NAME = "Hammerbarn Store Ops Platform"
EPIC_TASKS = (
    ("epic-order-fulfilment", "Order Fulfilment Revamp", "Digitise goods-in checklist", "Done"),
    ("epic-order-fulfilment", "Order Fulfilment Revamp", "Pick-face barcode scanning", "Done"),
    ("epic-order-fulfilment", "Order Fulfilment Revamp", "Reorder-point auto alerts", "Ready"),
    (
        "epic-order-fulfilment",
        "Order Fulfilment Revamp",
        "Warehouse pick-path optimiser",
        "Queued",
    ),
    ("epic-trade-pricing", "Trade Pricing Engine", "Trade account tiered pricing", "Done"),
    ("epic-trade-pricing", "Trade Pricing Engine", "Bulk quote generator", "Blocked"),
    ("epic-trade-pricing", "Trade Pricing Engine", "Price-match audit trail", "revision"),
    ("epic-online-ordering", "Online Ordering Experience", "Click & collect slot booking", "Done"),
    ("epic-online-ordering", "Online Ordering Experience", "Guest checkout flow", "Ready"),
    (
        "epic-online-ordering",
        "Online Ordering Experience",
        "Order tracking notifications",
        "Queued",
    ),
)

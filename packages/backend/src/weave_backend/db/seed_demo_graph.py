"""`DEMO_OPS`: the CE-WRITE-1 op batch `db/seed_demo.py` applies to build the
demo BPMO graph (Actor/Process/Activity/Goal/Capability/System/Data, 8
glossary terms, 3 voice rules, 2 brand standards). Split out from
`seed_demo_data.py` for Law E's file-length budget -- pure data, no logic.
"""

from __future__ import annotations

from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp, Op

# Demo BPMO graph: only kinds/predicates confirmed live in
# `ontology/shapes/framework.shacl.ttl` (weave:label on every kind,
# weave:performedBy Process->Actor, weave:servesGoal
# BusinessCapability->Goal, weave:description on Activity) -- never an
# invented predicate (ontology-standards.md).
#
# `description` is also set on the Actor/Process nodes below (not just
# Activity) so the 3 tenant SHACL shapes seeded by `_seed_shapes` -- each
# requiring `weave:description` at `sh:Violation` -- validate clean out of
# the box (a first "Run validation" click shows zero violations, not a
# pre-seeded failure state; deliberate demo-polish simplification).
_SKOS = "http://www.w3.org/2004/02/skos/core#"

DEMO_OPS: list[Op] = [
    AddNodeOp(
        op="add_node",
        ref="actor",
        kind="Actor",
        label="Order Desk Team",
        properties={"description": "Handles incoming trade + online orders for the store."},
    ),
    AddNodeOp(
        op="add_node",
        ref="process",
        kind="Process",
        label="Order Fulfillment",
        properties={"description": "Gets a placed order into the customer's hands."},
    ),
    AddNodeOp(
        op="add_node",
        ref="activity",
        kind="Activity",
        label="Pick Items from Warehouse",
        properties={"description": "Pick ordered items from warehouse shelves."},
    ),
    AddNodeOp(op="add_node", ref="goal", kind="Goal", label="Reduce order cycle time"),
    AddNodeOp(
        op="add_node",
        ref="capability",
        kind="BusinessCapability",
        label="Fulfilment Operations",
    ),
    AddNodeOp(op="add_node", ref="system", kind="System", label="Warehouse Management System"),
    AddNodeOp(op="add_node", ref="data", kind="DataAsset", label="Customer Order"),
    AddEdgeOp(op="add_edge", subject_ref="process", predicate="performedBy", object_ref="actor"),
    AddEdgeOp(op="add_edge", subject_ref="capability", predicate="servesGoal", object_ref="goal"),
    # Glossary: 8 skos:Concept terms with definitions, so the Glossary page
    # stops showing "--" for every definition (the "related" chips column
    # already renders once broader/narrower edges below exist -- the
    # definition column has a separate frontend bug, `buildGlossaryBrowseQuery`
    # never SELECTs `?definition`; reported out of this backend-only lane).
    AddNodeOp(
        op="add_node",
        ref="term-dc",
        kind=f"{_SKOS}Concept",
        label="Distribution Centre (DC)",
        properties={
            f"{_SKOS}prefLabel": {"value": "Distribution Centre (DC)", "lang": "en"},
            f"{_SKOS}definition": "The regional warehouse that receives stock from "
            "suppliers and ships it on to stores.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-goods-in-bay",
        kind=f"{_SKOS}Concept",
        label="Goods-In Bay",
        properties={
            f"{_SKOS}prefLabel": {"value": "Goods-In Bay", "lang": "en"},
            f"{_SKOS}definition": "The loading-dock area of a DC where inbound "
            "deliveries are checked in against a purchase order.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-pick-face",
        kind=f"{_SKOS}Concept",
        label="Pick Face",
        properties={
            f"{_SKOS}prefLabel": {"value": "Pick Face", "lang": "en"},
            f"{_SKOS}definition": "The shelf or bin location a picker goes to "
            "when fulfilling an order for a given SKU.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-core-line",
        kind=f"{_SKOS}Concept",
        label="Core Line",
        properties={
            f"{_SKOS}prefLabel": {"value": "Core Line", "lang": "en"},
            f"{_SKOS}definition": "A product every branch is required to stock "
            "year-round, regardless of local demand.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-sku",
        kind=f"{_SKOS}Concept",
        label="SKU",
        properties={
            f"{_SKOS}prefLabel": {"value": "SKU", "lang": "en"},
            f"{_SKOS}definition": "Stock Keeping Unit -- the unique code identifying "
            "one specific, orderable product variant.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-reorder-point",
        kind=f"{_SKOS}Concept",
        label="Reorder Point",
        properties={
            f"{_SKOS}prefLabel": {"value": "Reorder Point", "lang": "en"},
            f"{_SKOS}definition": "The stock level at which a fresh purchase order "
            "to the supplier is automatically triggered.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-trade-account",
        kind=f"{_SKOS}Concept",
        label="Trade Account",
        properties={
            f"{_SKOS}prefLabel": {"value": "Trade Account", "lang": "en"},
            f"{_SKOS}definition": "A registered business customer's account, "
            "carrying its own negotiated pricing and credit terms.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="term-click-and-collect",
        kind=f"{_SKOS}Concept",
        label="Click & Collect",
        properties={
            f"{_SKOS}prefLabel": {"value": "Click & Collect", "lang": "en"},
            f"{_SKOS}definition": "An online order picked and held at a branch "
            "for the customer to collect in person.",
        },
    ),
    AddEdgeOp(
        op="add_edge",
        subject_ref="term-goods-in-bay",
        predicate=f"{_SKOS}broader",
        object_ref="term-dc",
    ),
    AddEdgeOp(
        op="add_edge",
        subject_ref="term-pick-face",
        predicate=f"{_SKOS}broader",
        object_ref="term-dc",
    ),
    AddEdgeOp(
        op="add_edge",
        subject_ref="term-sku",
        predicate=f"{_SKOS}broader",
        object_ref="term-core-line",
    ),
    # Branding & standards: voice rules + standards individuals, read by the
    # Brand & Standards tab straight off the draft graph
    # (`app/ce/brand/queries.ts`'s `voiceRulesQuery`/`standardsQuery`).
    AddNodeOp(
        op="add_node",
        ref="voice-tone",
        kind="VoiceRule",
        label="Friendly, practical, trade-savvy tone",
        properties={
            "ruleId": "tone-friendly-practical",
            "severity": "normal",
            "assertion": "Copy reads like a helpful colleague on the shop floor -- "
            "friendly, practical, trade-savvy -- never corporate marketing voice.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="voice-jargon",
        kind="VoiceRule",
        label="No unexplained trade jargon",
        properties={
            "ruleId": "no-jargon-without-explanation",
            "severity": "critical",
            "assertion": "Trade jargon (SKU, DC, core line) never appears in "
            "customer-facing copy without a plain-English gloss on first use.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="voice-next-step",
        kind="VoiceRule",
        label="Always name the next step",
        properties={
            "ruleId": "always-name-next-step",
            "severity": "normal",
            "assertion": "Every customer-facing message ends with one clear, "
            "concrete next step (e.g. 'Track your order').",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="brand-standard-voice",
        kind="BrandStandard",
        label="Tone of Voice Guide",
        properties={
            "contentType": "tone_of_voice_guide",
            "effectiveDate": "2026-01-06",
            "owner": "Head of Brand",
            "contentBody": "Hammerbarn speaks like the trade professional behind "
            "the counter: direct, warm, no fluff. Every word should sound like it "
            "could be said out loud in the store.",
        },
    ),
    AddNodeOp(
        op="add_node",
        ref="brand-standard-logo",
        kind="BrandStandard",
        label="Logo Usage Policy",
        properties={
            "contentType": "logo_usage_policy",
            "effectiveDate": "2026-01-06",
            "owner": "Head of Brand",
            "sourceUri": "https://brand.hammerbarn.example/logo-usage",
        },
    ),
]

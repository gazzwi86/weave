"""Hand-authored content source for the Hammerbarn seed (TASK-002).

Representative encoding of `docs/specs/weave/hammerbarn-content-brief.md`
§3-§12 (M1 scope) as `weave_backend.schemas.operations.Op` instances --
hand-authored Python, not a markdown/Turtle parser (the brief itself says
its Turtle is "representative...not an exhaustive triple dump"; ADR-010
records the decision not to parse it).

Two flat, ordered lists: `NODE_OPS` (domains/capabilities/goals before the
vocabulary/actors/systems/data before processes/activities/events -- nodes
always precede any edge that references their `ref`) and `EDGE_OPS` (every
relationship, added only after every node exists). `compile.py` batches
these two lists, in order, into CE-WRITE-1 apply batches.
"""

from __future__ import annotations

from weave_backend.schemas.operations import AddEdgeOp, AddNodeOp

# -- Business domains (weave:BusinessDomain) --------------------------------
_DOMAINS = [
    ("domain-retail-ops", "Retail Operations"),
    ("domain-supply-chain", "Supply Chain & Logistics"),
    ("domain-merchandising", "Merchandising"),
    ("domain-customer-trade", "Customer & Trade"),
    ("domain-finance", "Finance"),
    ("domain-people", "People & HR"),
]

# -- Goals (weave:Goal) ------------------------------------------------------
_GOALS = [
    ("goal-reduce-stockouts", "Reduce stockouts on core lines"),
    ("goal-next-day-trade", "Next-day trade fulfilment"),
    ("goal-grow-trade-revenue", "Grow trade revenue"),
    ("goal-improve-margin", "Improve gross margin"),
    ("goal-single-visit-cnc", "One-visit click-and-collect"),
]

# -- Business capabilities (weave:BusinessCapability) ------------------------
# (ref, label, in_domain_ref, [goal_refs])
_CAPABILITIES = [
    ("cap-store-operations", "Store Operations", "domain-retail-ops", ["goal-single-visit-cnc"]),
    (
        "cap-inventory-mgmt",
        "Inventory Management",
        "domain-supply-chain",
        ["goal-reduce-stockouts"],
    ),
    (
        "cap-procurement",
        "Procurement",
        "domain-merchandising",
        ["goal-reduce-stockouts", "goal-improve-margin"],
    ),
    (
        "cap-order-fulfilment",
        "Order Fulfilment",
        "domain-retail-ops",
        ["goal-next-day-trade", "goal-single-visit-cnc"],
    ),
    (
        "cap-returns-handling",
        "Returns Handling",
        "domain-customer-trade",
        ["goal-single-visit-cnc"],
    ),
    (
        "cap-pricing-promotion",
        "Pricing & Promotion",
        "domain-merchandising",
        ["goal-improve-margin"],
    ),
    (
        "cap-trade-account-mgmt",
        "Trade Account Mgmt",
        "domain-customer-trade",
        ["goal-grow-trade-revenue", "goal-next-day-trade"],
    ),
]

# -- Domain vocabulary (weave:Class, punned weave:Concept -- Decision B1) ---
_CLASSES = [
    ("class-product", "Product", "A sellable item in Hammerbarn's range, identified by SKU."),
    ("class-store", "Store", "A physical Hammerbarn retail+warehouse location."),
    ("class-supplier", "Supplier", "An external party Hammerbarn buys stock from."),
    ("class-customer", "Customer", "A buyer -- consumer or trade."),
    ("class-order", "Order", "A customer's request to buy, across any channel."),
    ("class-stock-item", "StockItem", "A Product's quantity at a specific location."),
    ("class-trade-account", "TradeAccount", "A credit account held by a trade customer."),
    ("class-purchase-order", "PurchaseOrder", "An order Hammerbarn raises on a Supplier."),
    ("class-promotion", "Promotion", "A time-boxed price reduction on a range of Products."),
    ("class-return", "Return", "A customer's request to send back a purchased Order."),
]

# -- Actors (weave:Actor) ----------------------------------------------------
# (ref, label, part_of_ref | None, additional_types)
_ACTORS = [
    ("actor-store-manager", "Store Manager", "actor-regional-manager", []),
    ("actor-regional-manager", "Regional Manager", "domain-retail-ops", []),
    ("actor-warehouse-operative", "Warehouse Operative", "actor-store-manager", []),
    ("actor-buyer", "Buyer / Merchandiser", "domain-merchandising", []),
    ("actor-trade-account-manager", "Trade Account Manager", "domain-customer-trade", []),
    ("actor-checkout-operator", "Checkout Operator", "actor-store-manager", []),
    ("actor-finance-clerk", "Finance Clerk", "domain-finance", []),
    ("actor-customer-service-agent", "Customer Service Agent", "domain-customer-trade", []),
    ("actor-it-admin", "IT / Systems Admin", "domain-finance", []),
    ("actor-head-office-it", "Head Office IT / Digital", None, []),
    (
        "actor-it-systems-manager",
        "IT Systems Manager",
        "actor-head-office-it",
        ["http://www.w3.org/ns/prov#Person"],
    ),
    (
        "actor-solutions-architect",
        "Solutions Architect",
        "actor-it-systems-manager",
        ["http://www.w3.org/ns/prov#Person"],
    ),
    (
        "actor-software-engineer",
        "Software Engineer",
        "actor-it-systems-manager",
        ["http://www.w3.org/ns/prov#Person"],
    ),
    (
        "actor-data-engineer",
        "Data Engineer",
        "actor-it-systems-manager",
        ["http://www.w3.org/ns/prov#Person"],
    ),
    (
        "actor-pricing-service",
        "Pricing Service (principal)",
        "domain-merchandising",
        ["http://www.w3.org/ns/prov#SoftwareAgent"],
    ),
    (
        "actor-notification-service",
        "Notification Service (principal)",
        "domain-retail-ops",
        ["http://www.w3.org/ns/prov#SoftwareAgent"],
    ),
]

# -- Systems & services (weave:System, weave:Service) ------------------------
_SYSTEMS = [
    ("system-pos", "System", "Point of Sale (POS)"),
    ("system-wms", "System", "Warehouse Management (WMS)"),
    ("system-erp-inventory", "System", "ERP / Inventory"),
    ("system-ecommerce", "System", "Retail Website (e-commerce)"),
    ("system-crm", "System", "CRM"),
    ("service-payment", "Service", "Payment Service"),
    ("service-notification", "Service", "Notification Service"),
    ("system-inventory-mgmt", "System", "Inventory Management app"),
    ("system-retail-app", "System", "Retail Mobile App"),
    ("system-delivery-logistics", "System", "Delivery & Logistics"),
    ("system-pricing", "System", "Pricing System"),
    ("system-loyalty", "System", "Customer Loyalty"),
    ("system-trade-crm", "System", "Trade CRM"),
]

# -- Data assets + fields (weave:DataAsset, weave:Field) ---------------------
_DATA_ASSETS = [
    ("data-product-catalogue", "Product Catalogue", []),
    (
        "data-stock-ledger",
        "Stock Ledger",
        ["field-stock-sku", "field-stock-location", "field-stock-on-hand"],
    ),
    ("data-purchase-orders", "Purchase Orders", ["field-po-number", "field-po-supplier"]),
    ("data-sales-orders", "Sales Orders", []),
    ("data-customer-records", "Customer Records", []),
    ("data-supplier-records", "Supplier Records", []),
    ("data-store-records", "Store Records", ["field-store-id", "field-store-region"]),
]
_FIELD_LABELS = {
    "field-stock-sku": "sku",
    "field-stock-location": "location",
    "field-stock-on-hand": "on_hand",
    "field-po-number": "po_number",
    "field-po-supplier": "supplier",
    "field-store-id": "store_id",
    "field-store-region": "region",
}

# -- Policies (weave:Policy) --------------------------------------------------
# (ref, label, governs_process_ref)
_POLICIES = [
    (
        "policy-goods-inward-po-match",
        "Goods-inward PO match required",
        "process-goods-inward",
    ),
    (
        "policy-refund-approval-threshold",
        "Refund approval threshold",
        "process-returns-refunds",
    ),
    ("policy-quarterly-stock-count", "Quarterly stock count", "process-stock-management"),
    ("policy-trade-credit-limit", "Trade credit limit", "process-customer-order"),
    (
        "policy-price-change-dual-auth",
        "Price-change dual authorisation",
        "process-pricing-promotions",
    ),
]

# -- Events (weave:Event) -----------------------------------------------------
_EVENTS = [
    ("event-delivery-arrived", "Supplier delivery arrived"),
    ("event-goods-received", "Goods received into stock"),
    ("event-low-stock", "Stock item below reorder point"),
    ("event-cycle-count-due", "Cycle count scheduled"),
    ("event-order-placed", "Customer order placed"),
    ("event-return-requested", "Customer return requested"),
    ("event-price-review-due", "Price review due"),
    ("event-promotion-planned", "Promotion planned"),
]

# -- Processes (weave:Process) + their steps (weave:Activity) ---------------
# Each process: (ref, label, in_domain, realizes_cap, triggered_by[], performed_by[],
#                runs_on[], data_consumes[], data_produces[], governed_by|None, steps)
# steps: (ref, label, step_order)
_PROCESSES = [
    (
        "process-goods-inward",
        "Goods Inward",
        "domain-supply-chain",
        "cap-inventory-mgmt",
        ["event-delivery-arrived"],
        ["actor-warehouse-operative"],
        ["system-wms"],
        ["data-purchase-orders"],
        ["data-stock-ledger"],
        "policy-goods-inward-po-match",
        [
            ("act-receive-delivery", "Receive delivery", 1),
            ("act-match-to-po", "Match to purchase order", 2),
            ("act-check-qty-condition", "Check quantity and condition", 3),
            ("act-record-discrepancy", "Record discrepancy", 4),
            ("act-update-stock-ledger", "Update stock ledger", 5),
            ("act-put-away", "Put away to location", 6),
        ],
    ),
    (
        "process-stock-management",
        "Stock Management",
        "domain-supply-chain",
        "cap-inventory-mgmt",
        ["event-low-stock", "event-cycle-count-due"],
        ["actor-store-manager", "actor-warehouse-operative"],
        ["system-erp-inventory"],
        ["data-stock-ledger"],
        ["data-stock-ledger", "data-purchase-orders"],
        "policy-quarterly-stock-count",
        [
            ("act-detect-low-stock", "Detect low stock", 1),
            ("act-evaluate-replenishment", "Evaluate replenishment source", 2),
            ("act-raise-replenishment", "Raise replenishment / purchase order", 3),
            ("act-cycle-count", "Cycle count", 4),
            ("act-reconcile-adjust", "Reconcile and post adjustment", 5),
        ],
    ),
    (
        "process-customer-order",
        "Customer Order",
        "domain-retail-ops",
        "cap-order-fulfilment",
        ["event-order-placed"],
        ["actor-checkout-operator", "actor-trade-account-manager"],
        ["system-pos", "system-ecommerce"],
        ["data-stock-ledger", "data-customer-records"],
        ["data-sales-orders"],
        "policy-trade-credit-limit",
        [
            ("act-capture-order", "Capture order", 1),
            ("act-price-order", "Price order (contract price for trade)", 2),
            ("act-authorise-payment", "Authorise payment or trade credit", 3),
            ("act-allocate-stock", "Allocate stock", 4),
            ("act-pick-and-stage", "Pick and stage (click-and-collect)", 5),
            ("act-notify-ready", "Notify customer ready", 6),
            ("act-complete-order", "Complete order", 7),
        ],
    ),
    (
        "process-returns-refunds",
        "Returns & Refunds",
        "domain-customer-trade",
        "cap-returns-handling",
        ["event-return-requested"],
        ["actor-checkout-operator", "actor-store-manager"],
        ["system-pos"],
        ["data-sales-orders"],
        ["data-stock-ledger"],
        "policy-refund-approval-threshold",
        [
            ("act-lookup-sale", "Lookup sale", 1),
            ("act-inspect-goods", "Inspect goods", 2),
            ("act-approve-refund", "Approve refund", 3),
            ("act-restock-or-writeoff", "Restock or write off", 4),
            ("act-issue-refund", "Issue refund", 5),
        ],
    ),
    (
        "process-pricing-promotions",
        "Pricing & Promotions",
        "domain-merchandising",
        "cap-pricing-promotion",
        ["event-price-review-due", "event-promotion-planned"],
        ["actor-buyer"],
        ["system-pricing"],
        ["data-product-catalogue"],
        ["data-product-catalogue"],
        "policy-price-change-dual-auth",
        [
            ("act-review-price", "Review price", 1),
            ("act-authorise-price-change", "Authorise price change (dual auth)", 2),
            ("act-publish-price", "Publish price", 3),
        ],
    ),
]

# -- Glossary (SKOS Concept-only; no owl:Class pun -- non-vocabulary terms) --
_GLOSSARY = [
    ("term-trade-counter", "Trade counter"),
    ("term-click-and-collect", "Click-and-collect"),
    ("term-goods-in-bay", "Goods-in bay"),
    ("term-core-line", "Core line"),
    ("term-cycle-count", "Cycle count"),
    ("term-reorder-point", "Reorder point"),
    ("term-dc", "DC"),
    ("term-put-away", "Put-away"),
]

SKOS_CONCEPT = "http://www.w3.org/2004/02/skos/core#Concept"
OWL_CLASS = "http://www.w3.org/2002/07/owl#Class"


def _node(ref: str, kind: str, label: str, **extra: object) -> AddNodeOp:
    return AddNodeOp(op="add_node", ref=ref, kind=kind, label=label, **extra)  # type: ignore[arg-type]


def _domain_node_ops() -> list[AddNodeOp]:
    return [_node(ref, "BusinessDomain", label) for ref, label in _DOMAINS]


def _goal_node_ops() -> list[AddNodeOp]:
    return [AddNodeOp(op="add_node", ref=ref, kind="Goal", label=label) for ref, label in _GOALS]


def _capability_node_ops() -> list[AddNodeOp]:
    return [
        AddNodeOp(op="add_node", ref=ref, kind="BusinessCapability", label=label)
        for ref, label, _domain, _goals in _CAPABILITIES
    ]


def _edge(subject_ref: str, predicate: str, object_ref: str) -> AddEdgeOp:
    return AddEdgeOp(
        op="add_edge", subject_ref=subject_ref, predicate=predicate, object_ref=object_ref
    )


def _capability_edge_ops() -> list[AddEdgeOp]:
    edges: list[AddEdgeOp] = []
    for ref, _label, domain_ref, goal_refs in _CAPABILITIES:
        edges.append(_edge(domain_ref, "hasCapability", ref))
        edges.extend(_edge(ref, "servesGoal", goal_ref) for goal_ref in goal_refs)
    return edges


def _class_node_ops() -> list[AddNodeOp]:
    return [
        AddNodeOp(
            op="add_node",
            ref=ref,
            kind="Class",
            label=label,
            properties={"http://www.w3.org/2004/02/skos/core#definition": definition},
            additional_types=[SKOS_CONCEPT, OWL_CLASS],
        )
        for ref, label, definition in _CLASSES
    ]


def _actor_node_ops() -> list[AddNodeOp]:
    return [
        _node(ref, "Actor", label, additional_types=list(extra_types))
        for ref, label, _part_of, extra_types in _ACTORS
    ]


def _actor_edge_ops() -> list[AddEdgeOp]:
    return [
        _edge(ref, "partOf", part_of)
        for ref, _label, part_of, _extra in _ACTORS
        if part_of is not None
    ]


def _system_node_ops() -> list[AddNodeOp]:
    return [_node(ref, kind, label) for ref, kind, label in _SYSTEMS]


def _data_asset_node_ops() -> list[AddNodeOp]:
    ops: list[AddNodeOp] = []
    for ref, label, field_refs in _DATA_ASSETS:
        ops.append(AddNodeOp(op="add_node", ref=ref, kind="DataAsset", label=label))
        for field_ref in field_refs:
            ops.append(_node(field_ref, "Field", _FIELD_LABELS[field_ref]))
    return ops


def _data_asset_edge_ops() -> list[AddEdgeOp]:
    edges: list[AddEdgeOp] = []
    for ref, _label, field_refs in _DATA_ASSETS:
        edges.extend(_edge(field_ref, "partOf", ref) for field_ref in field_refs)
    return edges


def _policy_node_ops() -> list[AddNodeOp]:
    return [_node(ref, "Policy", label) for ref, label, _governs in _POLICIES]


def _event_node_ops() -> list[AddNodeOp]:
    return [AddNodeOp(op="add_node", ref=ref, kind="Event", label=label) for ref, label in _EVENTS]


def _process_node_ops() -> list[AddNodeOp]:
    ops: list[AddNodeOp] = []
    for (
        ref,
        label,
        _domain,
        _cap,
        _trig,
        _perf,
        _runs,
        _consumes,
        _produces,
        _governs,
        steps,
    ) in _PROCESSES:
        ops.append(AddNodeOp(op="add_node", ref=ref, kind="Process", label=label))
        for step_ref, step_label, step_order in steps:
            ops.append(
                AddNodeOp(
                    op="add_node",
                    ref=step_ref,
                    kind="Activity",
                    label=step_label,
                    properties={"stepOrder": step_order},
                )
            )
    return ops


def _process_edge_ops() -> list[AddEdgeOp]:
    edges: list[AddEdgeOp] = []
    for (
        ref,
        _label,
        domain_ref,
        cap_ref,
        trig_refs,
        perf_refs,
        runs_refs,
        consumes_refs,
        produces_refs,
        governs_ref,
        steps,
    ) in _PROCESSES:
        edges.append(_edge(ref, "inDomain", domain_ref))
        edges.append(_edge(ref, "realizes", cap_ref))
        edges.extend(_edge(ref, "triggeredBy", trig) for trig in trig_refs)
        edges.extend(_edge(ref, "performedBy", perf) for perf in perf_refs)
        edges.extend(_edge(ref, "runsOn", runs) for runs in runs_refs)
        edges.extend(_edge(ref, "consumes", consumed) for consumed in consumes_refs)
        edges.extend(_edge(ref, "produces", produced) for produced in produces_refs)
        if governs_ref is not None:
            edges.append(_edge(ref, "governedBy", governs_ref))
        edges.extend(_edge(ref, "hasStep", step_ref) for step_ref, _label, _order in steps)
    return edges


def _glossary_node_ops() -> list[AddNodeOp]:
    return [
        AddNodeOp(
            op="add_node", ref=ref, kind="Concept", label=label, additional_types=[SKOS_CONCEPT]
        )
        for ref, label in _GLOSSARY
    ]


def node_ops() -> list[AddNodeOp]:
    """Every node op, in an order that never forward-references a `ref`."""
    return [
        *_domain_node_ops(),
        *_goal_node_ops(),
        *_capability_node_ops(),
        *_class_node_ops(),
        *_actor_node_ops(),
        *_system_node_ops(),
        *_data_asset_node_ops(),
        *_policy_node_ops(),
        *_event_node_ops(),
        *_process_node_ops(),
        *_glossary_node_ops(),
    ]


def edge_ops() -> list[AddEdgeOp]:
    """Every edge op -- always emitted after `node_ops()` so every `ref` it
    cites already exists.
    """
    return [
        *_capability_edge_ops(),
        *_actor_edge_ops(),
        *_data_asset_edge_ops(),
        *_process_edge_ops(),
    ]

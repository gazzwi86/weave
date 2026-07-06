---
type: reference
title: Hammerbarn Content Brief
description: "Authoritative definition of the fictional demo company (Hammerbarn) whose data seeds Weave's
  Constitution Engine, Graph Explorer, and (post-v1) Build + Events engines. Instance population of the
  BPMO framework; seed-authoring source for CE-TASK-005; rendered by Onboarding EPIC-001."
tags: [reference, content, hammerbarn, seed, bpmo, onboarding]
status: Draft
timestamp: 2026-07-06T00:00:00Z
resource: docs/specs/weave/hammerbarn-content-brief.md
source: hand-authored
confirmed_by: none
confirmed_on: null
expires_on: 2027-01-06
owner: gazzwi86
created: 2026-07-06
coverage: n/a
---

# Hammerbarn Content Brief

This is the authoritative definition of **Hammerbarn** — a deliberately fictional big-box home-improvement
retailer used as Weave's fully-modelled example company. Hammerbarn is the "see what good looks like"
worked example: a proper **BPMO business brain** an AI agent can reason inside, not a toy dataset. It is
fictional (Bunnings / B&Q / Kingfisher flavour) to stay trademark-clean while remaining realistic.

Everything below is an **instance population of Weave's shipped BPMO upper framework** (CE-READ-1). The
framework's 13 kinds are the grammar; Hammerbarn's own nouns (Product, Store, Supplier…) are its
*vocabulary*, modelled as `weave:Class` definitions — never as new kinds (see **Decision B1**, §10).

All Turtle blocks in this file assume these prefixes:

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .
```

Instance IRIs use the `ex:` prefix. The published canonical seed lands in the named graph
`weave:graph/v1.0.0`.

---

## 1. Purpose & consumers

This file is the single content source for the Hammerbarn seed. It is **content, not spec** — counts and
thresholds here are targets owned by the content admin, not contractual constants. The only contractual
shape it must honour: every Hammerbarn entity maps to exactly one BPMO kind (CE-READ-1), with **Process as
the spine**.

Who reads it:

- **CE-TASK-005 (Instance Data Population)** — the seed author encodes each section below as `add_node` /
  `add_edge` operations submitted through **CE-WRITE-1** (`POST /api/operations/apply`). Every entity kind
  must be one of the BPMO 13; SHACL-valid on the throwaway clone before commit.
- **Onboarding EPIC-001** — renders this seed as the read-only canonical Hammerbarn workspace and the
  per-user writable sandbox fork. Onboarding is the *integrator*, not the producer.
- **Graph Explorer (M1)** — the seed is what a new user explores on the canvas.
- **Build + Events (post-v1)** — extend the seed with the Kitchen Designer app (BE-ARTEFACT-1) and example
  automations (EA-AUTOMATION-1). Stubbed here (§13), authored later.

**Primary audience — Hammerbarn's Head Office IT Systems / Digital team.** This team is the archetypal
Weave customer and the star of the demo's "why Weave" narrative. They model the company's operations as the
BPMO ontology (this brief), then use Weave's **Build** engine to generate the apps that run the business
(retail site and mobile app, inventory management, customer loyalty) and the **Events** engine to run the
automations that keep it moving (pricing propagation, delivery notifications, stock reorder) — every one
grounded in the same ontology. This is exactly what the **Technical** onboarding path showcases: model
once, then generate and operate the digital estate from the model.

**Live-pipeline principle.** The seed is **authored through the engines, not shipped as a static RDF
snapshot.** Ontology/glossary/brand/governance are written via CE-WRITE-1; the Build project via
BE-ARTEFACT-1; automations via EA-AUTOMATION-1. This keeps the demo in step with the real product — if a
contract changes, re-running the pipeline regenerates a valid seed rather than leaving a stale dump.

---

## 2. The business at a glance

**Hammerbarn** is a UK home-improvement and hardware retailer operating a **warehouse+retail** big-box
format — large stores that are part shop floor, part trade counter, part on-site warehouse. It serves two
customer segments from the same estate: **consumers** (DIY, home, garden) and **trade** (builders,
tradespeople, small contractors on credit accounts). The reference scale for the seed is **42 stores across
England, Wales and Scotland, fed by 3 regional distribution centres (DCs)**, with a central head-office
Merchandising, Finance and People function.

Revenue lines, in rough order of size: **in-store retail sales** (consumer), **trade account sales** (on
credit, volume-priced), **click-and-collect** (order online, pick up in ~1 hour from the trade counter),
**home delivery** (kerbside and room-of-choice for bulky goods), and a small **tool & plant hire** line
(flavour only — not modelled as a process; OQ-HB-4). Hammerbarn's promise is broad range, trade-friendly
pricing, and
reliable next-day availability of core lines — which is why *reduce stockouts* and *next-day trade
fulfilment* (§5) sit at the top of its goal set.

---

## 3. Business domains (`weave:BusinessDomain`)

The top-level partition of the business. Domains hold capabilities (§4); capabilities are realized by
processes (§6).

| IRI | Label | Scope |
|---|---|---|
| `ex:domain-retail-ops` | Retail Operations | Store estate, shop floor, checkout, click-and-collect fulfilment |
| `ex:domain-supply-chain` | Supply Chain & Logistics | DCs, goods inward, stock movement, replenishment, delivery |
| `ex:domain-merchandising` | Merchandising | Range, buying, pricing, promotions, supplier management |
| `ex:domain-customer-trade` | Customer & Trade | Consumer service, trade accounts, credit, CRM |
| `ex:domain-finance` | Finance | Payments, invoicing, credit control, reconciliation |
| `ex:domain-people` | People & HR | Rostering, roles, training, store staffing |

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:domain-retail-ops    a weave:BusinessDomain ; rdfs:label "Retail Operations" ;
    rdfs:comment "Store estate, shop floor, checkout and click-and-collect fulfilment." .
ex:domain-supply-chain  a weave:BusinessDomain ; rdfs:label "Supply Chain & Logistics" ;
    rdfs:comment "Distribution centres, goods inward, stock movement, replenishment and delivery." .
ex:domain-merchandising a weave:BusinessDomain ; rdfs:label "Merchandising" ;
    rdfs:comment "Range, buying, pricing, promotions and supplier management." .
ex:domain-customer-trade a weave:BusinessDomain ; rdfs:label "Customer & Trade" ;
    rdfs:comment "Consumer service, trade accounts, credit and CRM." .
ex:domain-finance       a weave:BusinessDomain ; rdfs:label "Finance" ;
    rdfs:comment "Payments, invoicing, credit control and reconciliation." .
ex:domain-people        a weave:BusinessDomain ; rdfs:label "People & HR" ;
    rdfs:comment "Rostering, roles, training and store staffing." .
```

---

## 4. Business capabilities (`weave:BusinessCapability`)

What the business is *able to do*. Each is realized by one or more processes (`weave:Process realizes
capability`), sits `inDomain` a domain, and serves goals (`servesGoal`). Note the direction:
`weave:realizes` runs Process → Capability (the process realises the capability); domains expose
capabilities via `weave:hasCapability`.

| IRI | Label | In domain | Serves goals |
|---|---|---|---|
| `ex:cap-store-operations` | Store Operations | `ex:domain-retail-ops` | single-visit-cnc |
| `ex:cap-inventory-mgmt` | Inventory Management | `ex:domain-supply-chain` | reduce-stockouts |
| `ex:cap-procurement` | Procurement | `ex:domain-merchandising` | reduce-stockouts, improve-margin |
| `ex:cap-order-fulfilment` | Order Fulfilment | `ex:domain-retail-ops` | next-day-trade, single-visit-cnc |
| `ex:cap-returns-handling` | Returns Handling | `ex:domain-customer-trade` | single-visit-cnc |
| `ex:cap-pricing-promotion` | Pricing & Promotion | `ex:domain-merchandising` | improve-margin |
| `ex:cap-trade-account-mgmt` | Trade Account Mgmt | `ex:domain-customer-trade` | grow-trade-rev, next-day-trade |

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:cap-inventory-mgmt a weave:BusinessCapability ; rdfs:label "Inventory Management" ;
    weave:inDomain   ex:domain-supply-chain ;
    weave:servesGoal ex:goal-reduce-stockouts .

ex:cap-order-fulfilment a weave:BusinessCapability ; rdfs:label "Order Fulfilment" ;
    weave:inDomain   ex:domain-retail-ops ;
    weave:servesGoal ex:goal-next-day-trade, ex:goal-single-visit-cnc .

ex:cap-trade-account-mgmt a weave:BusinessCapability ; rdfs:label "Trade Account Management" ;
    weave:inDomain   ex:domain-customer-trade ;
    weave:servesGoal ex:goal-grow-trade-revenue, ex:goal-next-day-trade .

# Domain → capability exposure (inverse view)
ex:domain-supply-chain weave:hasCapability ex:cap-inventory-mgmt .
ex:domain-merchandising weave:hasCapability ex:cap-procurement, ex:cap-pricing-promotion .
# … remaining capabilities follow the same shape (see table above).
```

---

## 5. Goals (`weave:Goal`)

The motivating outcomes the capabilities and processes serve. Deliberately few and business-legible.

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:goal-reduce-stockouts a weave:Goal ; rdfs:label "Reduce stockouts on core lines" ;
    rdfs:comment "Keep the top-selling core range available; target ≥ 98% shelf availability." .
ex:goal-next-day-trade a weave:Goal ; rdfs:label "Next-day trade fulfilment" ;
    rdfs:comment "Trade orders placed by cut-off are available for collection or delivery next working day." .
ex:goal-grow-trade-revenue a weave:Goal ; rdfs:label "Grow trade revenue" ;
    rdfs:comment "Increase share of revenue from credit-account trade customers." .
ex:goal-improve-margin a weave:Goal ; rdfs:label "Improve gross margin" ;
    rdfs:comment "Protect margin through disciplined buying, pricing and promotion." .
ex:goal-single-visit-cnc a weave:Goal ; rdfs:label "One-visit click-and-collect" ;
    rdfs:comment "Online orders are picked and ready before the customer arrives; no counter wait." .
```

---

## 6. Core business processes (`weave:Process`)

Five named processes are modelled in full. The Onboarding spec names the first three as required; Returns
& Refunds and Pricing & Promotions are added for breadth. **Process is the spine of the model** — each one
edges out to its `weave:Activity` steps (`hasStep`, ordered), triggering `weave:Event`s (`triggeredBy`),
`weave:Actor`s (`performedBy`), `weave:System`/`weave:Service` it uses (`runsOn` / `accesses`),
`weave:DataAsset`s it `consumes`/`produces`, the `weave:BusinessCapability` it `realizes`, its
`weave:BusinessDomain` (`inDomain`), and governing `weave:Policy`s (`governedBy`).

Ordering of activities is expressed with `hasStep` plus an integer `weave:stepOrder` on each Activity (the
framework's ordering convention). Seed authors: the Turtle per process is *representative* — enough to
complete the population unambiguously, not an exhaustive triple dump.

### 6.1 Goods Inward

**Walkthrough.** A supplier delivery arrives at a DC or store goods-in bay. The Warehouse Operative books
it in against the expected **Purchase Order** (the *goods-inward PO-match* policy forbids booking stock with
no matching PO). Quantities and condition are checked; discrepancies are flagged to the Buyer. On a clean
match the **Stock Ledger** is incremented, the PO is marked received, and put-away tasks are issued by the
WMS. A `goods-received` event is emitted — this is the same event the post-v1 Slack automation listens to
(§13).

- **Steps:** `receive-delivery` → `match-to-po` → `check-quantity-condition` → `record-discrepancy`
  (conditional) → `update-stock-ledger` → `put-away`
- **Triggered by:** `ex:event-delivery-arrived`
- **Performed by:** `ex:actor-warehouse-operative` (with `ex:actor-buyer` on discrepancy)
- **Runs on / accesses:** `ex:system-wms`, `ex:system-erp-inventory`; data `ex:data-purchase-orders`
  (consumes), `ex:data-stock-ledger` (produces)
- **Realizes:** `ex:cap-inventory-mgmt` · **In domain:** `ex:domain-supply-chain`
- **Produces event:** `ex:event-goods-received`
- **Governed by:** `ex:policy-goods-inward-po-match`

```turtle
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:process-goods-inward a weave:Process ; rdfs:label "Goods Inward" ;
    rdfs:comment "Book incoming supplier deliveries into stock against a matching purchase order." ;
    weave:inDomain     ex:domain-supply-chain ;
    weave:realizes     ex:cap-inventory-mgmt ;
    weave:triggeredBy  ex:event-delivery-arrived ;
    weave:produces     ex:event-goods-received ;
    weave:performedBy  ex:actor-warehouse-operative ;
    weave:runsOn       ex:system-wms ;
    weave:accesses     ex:system-erp-inventory ;
    weave:consumes     ex:data-purchase-orders ;
    weave:produces     ex:data-stock-ledger ;
    weave:governedBy   ex:policy-goods-inward-po-match ;
    weave:hasStep      ex:act-receive-delivery, ex:act-match-to-po, ex:act-check-qty-condition,
                       ex:act-record-discrepancy, ex:act-update-stock-ledger, ex:act-put-away .

ex:act-receive-delivery   a weave:Activity ; rdfs:label "Receive delivery" ;
    weave:stepOrder 1 ; weave:performedBy ex:actor-warehouse-operative .
ex:act-match-to-po        a weave:Activity ; rdfs:label "Match to purchase order" ;
    weave:stepOrder 2 ; weave:consumes ex:data-purchase-orders ; weave:runsOn ex:system-erp-inventory .
ex:act-check-qty-condition a weave:Activity ; rdfs:label "Check quantity and condition" ;
    weave:stepOrder 3 .
ex:act-record-discrepancy a weave:Activity ; rdfs:label "Record discrepancy" ;
    weave:stepOrder 4 ; weave:performedBy ex:actor-buyer ;
    rdfs:comment "Conditional: only when checked quantity/condition differs from the PO." .
ex:act-update-stock-ledger a weave:Activity ; rdfs:label "Update stock ledger" ;
    weave:stepOrder 5 ; weave:produces ex:data-stock-ledger ; weave:runsOn ex:system-erp-inventory .
ex:act-put-away           a weave:Activity ; rdfs:label "Put away to location" ;
    weave:stepOrder 6 ; weave:runsOn ex:system-wms .

ex:event-delivery-arrived a weave:Event ; rdfs:label "Supplier delivery arrived" .
ex:event-goods-received   a weave:Event ; rdfs:label "Goods received into stock" .
```

### 6.2 Stock Management

**Walkthrough.** Stock Management keeps shelves filled and the ledger honest. It runs on two triggers: a
**low-stock** event (a StockItem drops below its reorder point) and a **scheduled cycle-count** event. On
low stock the process proposes a replenishment — either a store-to-DC pull or, if DC stock is short, a new
Purchase Order raised to the Buyer for supplier order. Cycle counts reconcile physical counts against the
Stock Ledger and post adjustments. The *quarterly full stock count* policy governs the periodic full count.

- **Steps:** `detect-low-stock` → `evaluate-replenishment` → `raise-replenishment` → `cycle-count`
  (scheduled branch) → `reconcile-adjust`
- **Triggered by:** `ex:event-low-stock`, `ex:event-cycle-count-due`
- **Performed by:** `ex:actor-store-manager`, `ex:actor-warehouse-operative`; `ex:actor-buyer` on reorder
- **Runs on / accesses:** `ex:system-erp-inventory`, `ex:system-wms`; data `ex:data-stock-ledger`
  (consumes+produces), `ex:data-purchase-orders` (produces on reorder)
- **Realizes:** `ex:cap-inventory-mgmt` · **In domain:** `ex:domain-supply-chain`
- **Governed by:** `ex:policy-quarterly-stock-count`

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:process-stock-management a weave:Process ; rdfs:label "Stock Management" ;
    rdfs:comment "Maintain shelf availability and ledger accuracy via replenishment and cycle counts." ;
    weave:inDomain    ex:domain-supply-chain ;
    weave:realizes    ex:cap-inventory-mgmt ;
    weave:triggeredBy ex:event-low-stock, ex:event-cycle-count-due ;
    weave:performedBy ex:actor-store-manager, ex:actor-warehouse-operative ;
    weave:runsOn      ex:system-erp-inventory ;
    weave:accesses    ex:system-wms ;
    weave:consumes    ex:data-stock-ledger ;
    weave:produces    ex:data-stock-ledger, ex:data-purchase-orders ;
    weave:governedBy  ex:policy-quarterly-stock-count ;
    weave:hasStep     ex:act-detect-low-stock, ex:act-evaluate-replenishment, ex:act-raise-replenishment,
                      ex:act-cycle-count, ex:act-reconcile-adjust .

ex:act-detect-low-stock     a weave:Activity ; rdfs:label "Detect low stock" ; weave:stepOrder 1 .
ex:act-evaluate-replenishment a weave:Activity ; rdfs:label "Evaluate replenishment source" ; weave:stepOrder 2 .
ex:act-raise-replenishment  a weave:Activity ; rdfs:label "Raise replenishment / purchase order" ;
    weave:stepOrder 3 ; weave:performedBy ex:actor-buyer ; weave:produces ex:data-purchase-orders .
ex:act-cycle-count          a weave:Activity ; rdfs:label "Cycle count" ; weave:stepOrder 4 .
ex:act-reconcile-adjust     a weave:Activity ; rdfs:label "Reconcile and post adjustment" ;
    weave:stepOrder 5 ; weave:produces ex:data-stock-ledger .

ex:event-low-stock       a weave:Event ; rdfs:label "Stock item below reorder point" .
ex:event-cycle-count-due a weave:Event ; rdfs:label "Cycle count scheduled" .
```

### 6.3 Customer Order (incl. click-and-collect)

**Walkthrough.** A customer places an order — at a POS till, at the trade counter, or on the e-commerce
site. The order is priced (trade accounts get contract pricing), payment or trade credit is authorised
(`accesses ex:service-payment`), and stock is allocated from the Stock Ledger. For **click-and-collect**,
a pick task is issued to the trade counter and the customer is notified when ready
(`accesses ex:service-notification`); for delivery, a despatch task is raised. The Sales Order is written
and the Stock Ledger decremented. This is the process the *one-visit click-and-collect* goal drives.

- **Steps:** `capture-order` → `price-order` → `authorise-payment` → `allocate-stock` →
  `pick-and-stage` (click-and-collect branch) → `notify-ready` → `complete-order`
- **Triggered by:** `ex:event-order-placed`
- **Performed by:** `ex:actor-checkout-operator`, `ex:actor-trade-account-manager` (trade),
  self-service on e-commerce
- **Runs on / accesses:** `ex:system-pos`, `ex:system-ecommerce`; services `ex:service-payment`,
  `ex:service-notification`; data `ex:data-sales-orders` (produces), `ex:data-stock-ledger` (consumes),
  `ex:data-customer-records` (consumes)
- **Realizes:** `ex:cap-order-fulfilment` · **In domain:** `ex:domain-retail-ops`
- **Governed by:** `ex:policy-trade-credit-limit` (trade orders only)

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:process-customer-order a weave:Process ; rdfs:label "Customer Order" ;
    rdfs:comment "Capture, price, pay for and fulfil a customer order incl. click-and-collect." ;
    weave:inDomain    ex:domain-retail-ops ;
    weave:realizes    ex:cap-order-fulfilment ;
    weave:triggeredBy ex:event-order-placed ;
    weave:performedBy ex:actor-checkout-operator, ex:actor-trade-account-manager ;
    weave:runsOn      ex:system-pos, ex:system-ecommerce ;
    weave:accesses    ex:service-payment, ex:service-notification ;
    weave:consumes    ex:data-stock-ledger, ex:data-customer-records ;
    weave:produces    ex:data-sales-orders ;
    weave:governedBy  ex:policy-trade-credit-limit ;
    weave:hasStep     ex:act-capture-order, ex:act-price-order, ex:act-authorise-payment,
                      ex:act-allocate-stock, ex:act-pick-and-stage, ex:act-notify-ready,
                      ex:act-complete-order .

ex:act-capture-order     a weave:Activity ; rdfs:label "Capture order" ; weave:stepOrder 1 .
ex:act-price-order       a weave:Activity ; rdfs:label "Price order (contract price for trade)" ;
    weave:stepOrder 2 ; weave:consumes ex:data-customer-records .
ex:act-authorise-payment a weave:Activity ; rdfs:label "Authorise payment or trade credit" ;
    weave:stepOrder 3 ; weave:accesses ex:service-payment ; weave:governedBy ex:policy-trade-credit-limit .
ex:act-allocate-stock    a weave:Activity ; rdfs:label "Allocate stock" ;
    weave:stepOrder 4 ; weave:consumes ex:data-stock-ledger .
ex:act-pick-and-stage    a weave:Activity ; rdfs:label "Pick and stage (click-and-collect)" ;
    weave:stepOrder 5 ; rdfs:comment "Conditional: click-and-collect and delivery orders only." .
ex:act-notify-ready      a weave:Activity ; rdfs:label "Notify customer ready" ;
    weave:stepOrder 6 ; weave:accesses ex:service-notification ;
    weave:performedBy ex:actor-notification-service .
ex:act-complete-order    a weave:Activity ; rdfs:label "Complete order" ;
    weave:stepOrder 7 ; weave:produces ex:data-sales-orders .

ex:event-order-placed a weave:Event ; rdfs:label "Customer order placed" .
```

### 6.4 Returns & Refunds

**Walkthrough.** A customer returns goods to a store or trade counter. The operator looks up the original
Sales Order, checks the return is within policy, and processes a refund. The *refund-approval-threshold*
policy requires manager approval for refunds over £50. Stock in saleable condition is returned to the
ledger; damaged stock is written off. A refund is issued via the payment service, and the Sales Order is
updated.

- **Steps:** `lookup-sale` → `inspect-goods` → `approve-refund` (conditional, > £50) → `restock-or-writeoff`
  → `issue-refund`
- **Triggered by:** `ex:event-return-requested`
- **Performed by:** `ex:actor-checkout-operator`, `ex:actor-store-manager` (approval)
- **Runs on / accesses:** `ex:system-pos`, `ex:system-erp-inventory`; service `ex:service-payment`;
  data `ex:data-sales-orders` (consumes), `ex:data-stock-ledger` (produces)
- **Realizes:** `ex:cap-returns-handling` · **In domain:** `ex:domain-customer-trade`
- **Governed by:** `ex:policy-refund-approval-threshold`

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:process-returns-refunds a weave:Process ; rdfs:label "Returns & Refunds" ;
    rdfs:comment "Accept returned goods, approve refunds within policy, and adjust stock." ;
    weave:inDomain    ex:domain-customer-trade ;
    weave:realizes    ex:cap-returns-handling ;
    weave:triggeredBy ex:event-return-requested ;
    weave:performedBy ex:actor-checkout-operator, ex:actor-store-manager ;
    weave:runsOn      ex:system-pos ;
    weave:accesses    ex:service-payment, ex:system-erp-inventory ;
    weave:consumes    ex:data-sales-orders ;
    weave:produces    ex:data-stock-ledger ;
    weave:governedBy  ex:policy-refund-approval-threshold ;
    weave:hasStep     ex:act-lookup-sale, ex:act-inspect-goods, ex:act-approve-refund,
                      ex:act-restock-or-writeoff, ex:act-issue-refund .

ex:act-lookup-sale         a weave:Activity ; rdfs:label "Look up original sale" ;
    weave:stepOrder 1 ; weave:consumes ex:data-sales-orders .
ex:act-inspect-goods       a weave:Activity ; rdfs:label "Inspect returned goods" ; weave:stepOrder 2 .
ex:act-approve-refund      a weave:Activity ; rdfs:label "Approve refund (manager, > £50)" ;
    weave:stepOrder 3 ; weave:performedBy ex:actor-store-manager ;
    weave:governedBy ex:policy-refund-approval-threshold .
ex:act-restock-or-writeoff a weave:Activity ; rdfs:label "Restock or write off" ;
    weave:stepOrder 4 ; weave:produces ex:data-stock-ledger .
ex:act-issue-refund        a weave:Activity ; rdfs:label "Issue refund" ;
    weave:stepOrder 5 ; weave:accesses ex:service-payment .

ex:event-return-requested a weave:Event ; rdfs:label "Customer return requested" .
```

### 6.5 Pricing & Promotions

**Walkthrough.** The Buyer/Merchandiser sets and changes prices and runs time-boxed promotions. A price
change is proposed, checked against margin floors, and — per the *price-change dual-authorisation* policy —
countersigned by a second authoriser before it goes live in the Product Catalogue and propagates to POS
and e-commerce. Promotions are scheduled with start/end dates and target product categories.

- **Steps:** `propose-price-change` → `check-margin` → `dual-authorise` → `publish-price` →
  `schedule-promotion` (promotion branch)
- **Triggered by:** `ex:event-price-review-due`, `ex:event-promotion-planned`
- **Performed by:** `ex:actor-buyer`, `ex:actor-regional-manager` (second authoriser)
- **Runs on / accesses:** `ex:system-erp-inventory`, `ex:system-pos`, `ex:system-ecommerce`;
  data `ex:data-product-catalogue` (produces)
- **Realizes:** `ex:cap-pricing-promotion` · **In domain:** `ex:domain-merchandising`
- **Governed by:** `ex:policy-price-change-dual-auth`

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:process-pricing-promotions a weave:Process ; rdfs:label "Pricing & Promotions" ;
    rdfs:comment "Set prices and run promotions under margin and dual-authorisation controls." ;
    weave:inDomain    ex:domain-merchandising ;
    weave:realizes    ex:cap-pricing-promotion ;
    weave:triggeredBy ex:event-price-review-due, ex:event-promotion-planned ;
    weave:performedBy ex:actor-buyer, ex:actor-regional-manager ;
    weave:runsOn      ex:system-erp-inventory ;
    weave:accesses    ex:system-pos, ex:system-ecommerce ;
    weave:produces    ex:data-product-catalogue ;
    weave:governedBy  ex:policy-price-change-dual-auth ;
    weave:hasStep     ex:act-propose-price-change, ex:act-check-margin, ex:act-dual-authorise,
                      ex:act-publish-price, ex:act-schedule-promotion .

ex:act-propose-price-change a weave:Activity ; rdfs:label "Propose price change" ; weave:stepOrder 1 .
ex:act-check-margin         a weave:Activity ; rdfs:label "Check against margin floor" ; weave:stepOrder 2 .
ex:act-dual-authorise       a weave:Activity ; rdfs:label "Dual authorise" ;
    weave:stepOrder 3 ; weave:performedBy ex:actor-regional-manager ;
    weave:governedBy ex:policy-price-change-dual-auth .
ex:act-publish-price        a weave:Activity ; rdfs:label "Publish price (propagate to POS/e-commerce)" ;
    weave:stepOrder 4 ; weave:produces ex:data-product-catalogue ;
    weave:performedBy ex:actor-pricing-service .
ex:act-schedule-promotion   a weave:Activity ; rdfs:label "Schedule promotion" ; weave:stepOrder 5 .

ex:event-price-review-due  a weave:Event ; rdfs:label "Price review due" .
ex:event-promotion-planned a weave:Event ; rdfs:label "Promotion planned" .
```

---

## 7. Actors & org chart (`weave:Actor`)

Roles that perform process activities. `weave:partOf` expresses reporting/org structure (a role sits
within a domain's function). The rightmost column maps each role to how Onboarding's **4 role paths**
(Business / Technical / Compliance / Admin) would surface the demo to a user in that role.

| IRI | Role | Reports to (`partOf`) | Onboarding path lens |
|---|---|---|---|
| `ex:actor-store-manager` | Store Manager | `ex:actor-regional-manager` | Business — runs a store; browses in NL |
| `ex:actor-regional-manager` | Regional Manager | `ex:domain-retail-ops` | Business — estate view, dashboards |
| `ex:actor-warehouse-operative` | Warehouse Operative | `ex:actor-store-manager` | Business (r/o) — goods-in/stock |
| `ex:actor-buyer` | Buyer / Merchandiser | `ex:domain-merchandising` | Technical — range, pricing, supplier data |
| `ex:actor-trade-account-manager` | Trade Account Manager | `ex:domain-customer-trade` | Business — trade accounts |
| `ex:actor-checkout-operator` | Checkout Operator | `ex:actor-store-manager` | Business (read-only variant) |
| `ex:actor-finance-clerk` | Finance Clerk | `ex:domain-finance` | Compliance — credit control, audit, policies |
| `ex:actor-customer-service-agent` | Customer Service Agent | `ex:domain-customer-trade` | Business |
| `ex:actor-it-admin` | IT / Systems Admin | `ex:domain-finance` | Admin — systems, connectors, RBAC |
| `ex:actor-it-systems-manager` | IT Systems Manager | `ex:actor-head-office-it` | Admin + Tech — owns digital estate |
| `ex:actor-solutions-architect` | Solutions Architect | `ex:actor-it-systems-manager` | Tech — models + designs apps |
| `ex:actor-software-engineer` | Software Engineer | `ex:actor-it-systems-manager` | Tech — builds apps + automations |
| `ex:actor-data-engineer` | Data Engineer | `ex:actor-it-systems-manager` | Tech — pipelines + integrations |
| `ex:actor-pricing-service` | Pricing Service (principal) | `ex:domain-merchandising` | automated — prices |
| `ex:actor-notification-service` | Notification Service (principal) | `ex:domain-retail-ops` | automated — ready |

**Head Office IT Systems / Digital team (primary Weave audience).** The `ex:actor-head-office-it` org unit
and its four roles above are the archetypal Weave users: they model Hammerbarn's operations as the BPMO
ontology, then generate and operate the digital estate (§8) from it — the Solutions Architect is the
Technical onboarding path's protagonist. All four are human (`prov:Person`), distinct from the automated
service principals below.

**Service principals (OQ-HB-6 resolved).** Automated process steps are attributed to their own
`weave:Actor` service principals — not left implicit on the System. Two are modelled: `ex:actor-pricing-service`
(price propagation to POS/e-commerce, §6.5) and `ex:actor-notification-service` (the "ready to collect"
message, §6.3, and the post-v1 goods-inward notification, §6.1/§13). In PROV-O these are
`prov:SoftwareAgent` principals, distinct from human `prov:Person` actors — which aligns with the Events
engine's per-automation-principal, no-self-approval governance model (each automation runs as its own
non-human identity, so an agent action can never masquerade as a human approval).

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:actor-store-manager   a weave:Actor ; rdfs:label "Store Manager" ;
    weave:partOf ex:actor-regional-manager .
ex:actor-regional-manager a weave:Actor ; rdfs:label "Regional Manager" ;
    weave:partOf ex:domain-retail-ops .
ex:actor-warehouse-operative a weave:Actor ; rdfs:label "Warehouse Operative" ;
    weave:partOf ex:actor-store-manager .
ex:actor-buyer           a weave:Actor ; rdfs:label "Buyer / Merchandiser" ;
    weave:partOf ex:domain-merchandising .
ex:actor-trade-account-manager a weave:Actor ; rdfs:label "Trade Account Manager" ;
    weave:partOf ex:domain-customer-trade .
ex:actor-checkout-operator a weave:Actor ; rdfs:label "Checkout Operator" ;
    weave:partOf ex:actor-store-manager .
ex:actor-finance-clerk   a weave:Actor ; rdfs:label "Finance Clerk" ;
    weave:partOf ex:domain-finance .
ex:actor-customer-service-agent a weave:Actor ; rdfs:label "Customer Service Agent" ;
    weave:partOf ex:domain-customer-trade .
ex:actor-it-admin        a weave:Actor ; rdfs:label "IT / Systems Admin" ;
    weave:partOf ex:domain-finance .

# Head Office IT Systems / Digital team (human, prov:Person) — primary Weave audience.
ex:actor-head-office-it a weave:Actor ; rdfs:label "Head Office IT / Digital" ;
    rdfs:comment "Head-Office org unit that models operations and builds/operates the digital estate (§8)." .
ex:actor-it-systems-manager a weave:Actor, prov:Person ; rdfs:label "IT Systems Manager" ;
    weave:partOf ex:actor-head-office-it ;
    rdfs:comment "Owns the digital estate." .
ex:actor-solutions-architect a weave:Actor, prov:Person ; rdfs:label "Solutions Architect" ;
    weave:partOf ex:actor-it-systems-manager ;
    rdfs:comment "Models the ontology and designs apps; the Technical onboarding path's protagonist." .
ex:actor-software-engineer a weave:Actor, prov:Person ; rdfs:label "Software Engineer" ;
    weave:partOf ex:actor-it-systems-manager ;
    rdfs:comment "Builds apps and automations from the ontology." .
ex:actor-data-engineer a weave:Actor, prov:Person ; rdfs:label "Data Engineer" ;
    weave:partOf ex:actor-it-systems-manager ;
    rdfs:comment "Builds data pipelines and integrations." .

# Service principals (non-human) — prov:SoftwareAgent, distinct from human prov:Person actors above.
ex:actor-pricing-service a weave:Actor, prov:SoftwareAgent ; rdfs:label "Pricing Service (principal)" ;
    weave:partOf ex:domain-merchandising ;
    rdfs:comment "Automated principal that propagates published prices to POS and e-commerce (§6.5)." .
ex:actor-notification-service a weave:Actor, prov:SoftwareAgent ; rdfs:label "Notification Service (principal)" ;
    weave:partOf ex:domain-retail-ops ;
    rdfs:comment "Automated principal that sends order-ready messages (§6.3) and post-v1 goods-inward alerts." .
```

---

## 8. Systems & services (`weave:System`, `weave:Service`)

`weave:System` = an application/platform a process runs on; `weave:Service` = a discrete capability a
process calls (often a boundary integration). Processes relate via `runsOn` (primary system of record) and
`accesses` (systems/services it also touches).

The **digital estate** below (from `ex:system-inventory-mgmt` down) is what Hammerbarn's Head Office IT
team (§7) builds and operates with Weave — apps generated by **Build**, automations run by **Events**, all
grounded in this ontology. The Solutions Architect and Software Engineer own the apps; the Data Engineer
owns the pipelines and integrations behind them.

| IRI | Kind | Label | Role |
|---|---|---|---|
| `ex:system-pos` | System | Point of Sale (POS) | Till + trade-counter sales |
| `ex:system-wms` | System | Warehouse Management (WMS) | DC receiving, put-away, picking |
| `ex:system-erp-inventory` | System | ERP / Inventory | Stock ledger, POs, system of record |
| `ex:system-ecommerce` | System | Retail Website (e-commerce) | Online orders, click-and-collect |
| `ex:system-crm` | System | CRM | Consumer customer records |
| `ex:service-payment` | Service | Payment Service | Card auth, refunds, trade credit auth |
| `ex:service-notification` | Service | Notification Service | SMS/email order-ready + delivery updates |
| `ex:system-inventory-mgmt` | System | Inventory Management app | IT-built inventory UI over ERP/Inventory |
| `ex:system-retail-app` | System | Retail Mobile App | Consumer mobile app |
| `ex:system-delivery-logistics` | System | Delivery & Logistics | Delivery scheduling + logistics |
| `ex:system-pricing` | System | Pricing System | Price mgmt + propagation (§6.5) |
| `ex:system-loyalty` | System | Customer Loyalty | Loyalty program + app |
| `ex:system-trade-crm` | System | Trade CRM | Trade-account CRM (consumer in `ex:system-crm`) |

`ex:system-retail-web` from the estate list is **consolidated into `ex:system-ecommerce`** (the retail
e-commerce website) rather than double-modelled.

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:system-pos           a weave:System ; rdfs:label "Point of Sale (POS)" .
ex:system-wms           a weave:System ; rdfs:label "Warehouse Management (WMS)" .
ex:system-erp-inventory a weave:System ; rdfs:label "ERP / Inventory" ;
    rdfs:comment "System of record for the stock ledger and purchase orders." .
ex:system-ecommerce     a weave:System ; rdfs:label "Retail Website (e-commerce)" ;
    rdfs:comment "Online orders and click-and-collect; consolidates the 'retail web' estate entry." .
ex:system-crm           a weave:System ; rdfs:label "CRM" ;
    rdfs:comment "Consumer customer records; trade accounts live in ex:system-trade-crm." .
ex:service-payment      a weave:Service ; rdfs:label "Payment Service" ;
    rdfs:comment "Card authorisation, refunds and trade-credit authorisation." .
ex:service-notification a weave:Service ; rdfs:label "Notification Service" ;
    rdfs:comment "Customer SMS/email for order-ready and delivery updates." .

# Digital estate — built and operated by the Head Office IT team (§7) via Build + Events.
ex:system-inventory-mgmt a weave:System ; rdfs:label "Inventory Management app" ;
    rdfs:comment "IT-built inventory management UI over the ERP/Inventory system of record." .
ex:system-retail-app a weave:System ; rdfs:label "Retail Mobile App" ;
    rdfs:comment "Consumer-facing mobile app." .
ex:system-delivery-logistics a weave:System ; rdfs:label "Delivery & Logistics" ;
    rdfs:comment "Delivery scheduling and logistics system." .
ex:system-pricing a weave:System ; rdfs:label "Pricing System" ;
    rdfs:comment "Price management and propagation (§6.5); ex:actor-pricing-service runs on it." .
ex:system-loyalty a weave:System ; rdfs:label "Customer Loyalty" ;
    rdfs:comment "Customer loyalty program and app." .
ex:system-trade-crm a weave:System ; rdfs:label "Trade CRM" ;
    rdfs:comment "CRM for trade accounts; consumer records in ex:system-crm." .
```

---

## 9. Data assets (`weave:DataAsset` + `weave:Field`)

The data each process consumes/produces. A `weave:DataAsset` groups `weave:Field`s (its columns/attributes)
via `weave:hasField` (a `partOf` inverse). Two assets are shown with field breakdowns; the rest list their
key fields in the table.

| IRI | Label | Key fields | Owned by (domain) |
|---|---|---|---|
| `ex:data-product-catalogue` | Product Catalogue | sku, name, category, price, margin_floor | Merchandising |
| `ex:data-stock-ledger` | Stock Ledger | sku, location, on_hand, allocated, reorder_point | Supply Chain |
| `ex:data-purchase-orders` | Purchase Orders | po_number, supplier, line_items, status, eta | Merchandising |
| `ex:data-sales-orders` | Sales Orders | order_number, customer, line_items, channel, total | Retail Ops |
| `ex:data-customer-records` | Customer Records | customer_id, name, type, contact | Customer & Trade |
| `ex:data-supplier-records` | Supplier Records | supplier_id, name, lead_time_days, terms | Merchandising |
| `ex:data-store-records` | Store Records | store_id, name, region, format | Retail Ops |

**Region is a plain field (OQ-HB-2 resolved).** A store's region is a `weave:Field` on Store Records —
values `North`, `Midlands`, `South`, `Scotland`, `Wales` — **not** a first-class entity. There is no Region
`weave:Actor` and no Region vocabulary `weave:Class`; region is simply an attribute of a Store.

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:data-stock-ledger a weave:DataAsset ; rdfs:label "Stock Ledger" ;
    rdfs:comment "Per-SKU, per-location on-hand and allocated quantities and reorder points." ;
    weave:hasField ex:field-stock-sku, ex:field-stock-location, ex:field-stock-on-hand,
                   ex:field-stock-allocated, ex:field-stock-reorder-point .

ex:field-stock-sku          a weave:Field ; rdfs:label "sku" ; weave:partOf ex:data-stock-ledger .
ex:field-stock-location     a weave:Field ; rdfs:label "location" ; weave:partOf ex:data-stock-ledger .
ex:field-stock-on-hand      a weave:Field ; rdfs:label "on_hand" ; weave:partOf ex:data-stock-ledger .
ex:field-stock-allocated    a weave:Field ; rdfs:label "allocated" ; weave:partOf ex:data-stock-ledger .
ex:field-stock-reorder-point a weave:Field ; rdfs:label "reorder_point" ; weave:partOf ex:data-stock-ledger .

ex:data-purchase-orders a weave:DataAsset ; rdfs:label "Purchase Orders" ;
    rdfs:comment "Orders raised on suppliers; matched against deliveries in Goods Inward." ;
    weave:hasField ex:field-po-number, ex:field-po-supplier, ex:field-po-line-items,
                   ex:field-po-status, ex:field-po-eta .

ex:field-po-number     a weave:Field ; rdfs:label "po_number" ; weave:partOf ex:data-purchase-orders .
ex:field-po-supplier   a weave:Field ; rdfs:label "supplier" ; weave:partOf ex:data-purchase-orders .
ex:field-po-line-items a weave:Field ; rdfs:label "line_items" ; weave:partOf ex:data-purchase-orders .
ex:field-po-status     a weave:Field ; rdfs:label "status" ; weave:partOf ex:data-purchase-orders .
ex:field-po-eta        a weave:Field ; rdfs:label "eta" ; weave:partOf ex:data-purchase-orders .

ex:data-store-records a weave:DataAsset ; rdfs:label "Store Records" ;
    rdfs:comment "Store master data; region is a plain field here (OQ-HB-2), not a first-class entity." ;
    weave:hasField ex:field-store-id, ex:field-store-name, ex:field-store-region, ex:field-store-format .

ex:field-store-id     a weave:Field ; rdfs:label "store_id" ; weave:partOf ex:data-store-records .
ex:field-store-name   a weave:Field ; rdfs:label "name" ; weave:partOf ex:data-store-records .
ex:field-store-region a weave:Field ; rdfs:label "region" ; weave:partOf ex:data-store-records ;
    weave:describes ex:class-store ;
    rdfs:comment "Enumerated: North | Midlands | South | Scotland | Wales. A field, not an entity." .
ex:field-store-format a weave:Field ; rdfs:label "format" ; weave:partOf ex:data-store-records .

# Remaining assets (fields listed in the table; expand to weave:Field as above when seeding):
ex:data-product-catalogue a weave:DataAsset ; rdfs:label "Product Catalogue" .
ex:data-sales-orders      a weave:DataAsset ; rdfs:label "Sales Orders" .
ex:data-customer-records  a weave:DataAsset ; rdfs:label "Customer Records" .
ex:data-supplier-records  a weave:DataAsset ; rdfs:label "Supplier Records" .
```

---

## 10. Domain vocabulary (`weave:Class` / `weave:Concept`) — Decision B1

**Decision B1 (critical).** Hammerbarn's domain nouns — Product, Store, Supplier, Customer, Order,
StockItem, TradeAccount, PurchaseOrder, Promotion, Return — are **NOT new framework kinds.** The BPMO 13
kinds are the *grammar*; these nouns are Hammerbarn's *vocabulary*, modelled as **`weave:Class` definitions
in Hammerbarn's own namespace, punned with `weave:Concept`** (OWL class punned with SKOS concept) so they
serve double duty: an OWL class the instance data can be typed against, and a glossary concept with a
human definition. If you are ever tempted to add a kind for one of these, add a `weave:Class` instead.

Why this matters: it keeps the shipped BPMO framework a clean, small upper grammar (13 kinds, stable across
every tenant) while letting each tenant grow an unbounded, tenant-specific vocabulary underneath it. The
seed demonstrates the pattern a real customer follows.

| IRI | Label (class) | SKOS gloss |
|---|---|---|
| `ex:class-product` | Product | A sellable item in Hammerbarn's range, identified by SKU. |
| `ex:class-store` | Store | A physical Hammerbarn retail+warehouse location. |
| `ex:class-supplier` | Supplier | An external party Hammerbarn buys stock from. |
| `ex:class-customer` | Customer | A buyer — consumer or trade. |
| `ex:class-order` | Order | A customer's request to buy, across any channel. |
| `ex:class-stock-item` | StockItem | A Product's quantity at a specific location. |
| `ex:class-trade-account` | TradeAccount | A credit account held by a trade customer. |
| `ex:class-purchase-order` | PurchaseOrder | An order Hammerbarn raises on a Supplier. |
| `ex:class-promotion` | Promotion | A time-boxed price offer on a category or product set. |
| `ex:class-return` | Return | Goods brought back by a customer for refund or exchange. |

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

# Punning: each is BOTH a weave:Class (OWL, for typing instance data)
# AND a weave:Concept (SKOS, for the glossary). Decision B1.
ex:class-product a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "Product" ; skos:prefLabel "Product" ;
    skos:definition "A sellable item in Hammerbarn's range, identified by SKU." ;
    skos:broader ex:class-stock-item .

ex:class-store a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "Store" ; skos:prefLabel "Store" ;
    skos:definition "A physical Hammerbarn retail+warehouse location." ;
    weave:hasField ex:field-store-region ;
    rdfs:comment "Region is a plain field (ex:field-store-region), not a first-class entity — OQ-HB-2." .

ex:class-supplier a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "Supplier" ; skos:prefLabel "Supplier" ;
    skos:definition "An external party Hammerbarn buys stock from." ;
    skos:related ex:class-purchase-order .

ex:class-customer a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "Customer" ; skos:prefLabel "Customer" ;
    skos:definition "A buyer — consumer or trade." ;
    skos:narrower ex:class-trade-account .

ex:class-trade-account a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "TradeAccount" ; skos:prefLabel "TradeAccount" ;
    skos:definition "A credit account held by a trade customer." ;
    skos:broader ex:class-customer .

ex:class-stock-item a weave:Class, weave:Concept, owl:Class, skos:Concept ;
    rdfs:label "StockItem" ; skos:prefLabel "StockItem" ;
    skos:definition "A Product's quantity at a specific location." .

# ex:class-order, ex:class-purchase-order, ex:class-promotion, ex:class-return follow the same
# quad-typed pattern (see table above for gloss text).
```

---

## 11. Policies & governance (`weave:Policy`)

Constraints and rules that govern processes. These carry the Compliance onboarding path — they are what a
compliance officer inspects (enforcement status, PROV-O audit). A `weave:Policy` is *human-readable intent*;
the *machine-evaluable* form of an enforceable one is a SHACL shape authored via CE-WRITE-1 (per contracts
§ CE, "enforcement lives in SHACL shapes, not in Policy"). Policies attach to processes/activities via
`weave:governedBy`.

| IRI | Rule | Governs (process) |
|---|---|---|
| `ex:policy-goods-inward-po-match` | No stock booked in without a matching open PO | goods-inward |
| `ex:policy-refund-approval-threshold` | Refunds over £50 require Store Manager approval | returns-refunds |
| `ex:policy-quarterly-stock-count` | A full stock count is completed each quarter | stock-management |
| `ex:policy-trade-credit-limit` | A trade order may not exceed the account's credit limit | customer-order |
| `ex:policy-price-change-dual-auth` | Price changes require a second authoriser | pricing-promotions |

```turtle
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix weave: <https://weave.io/ontology/> .
@prefix ex:    <https://weave.io/instances/> .

ex:policy-goods-inward-po-match a weave:Policy ; rdfs:label "Goods-inward PO match required" ;
    rdfs:comment "No stock may be booked into the ledger without a matching open purchase order." .
ex:policy-refund-approval-threshold a weave:Policy ; rdfs:label "Refund approval threshold" ;
    rdfs:comment "Refunds over £50 require Store Manager approval before the refund is issued." .
ex:policy-quarterly-stock-count a weave:Policy ; rdfs:label "Quarterly stock count" ;
    rdfs:comment "A full physical stock count is completed and reconciled each quarter." .
ex:policy-trade-credit-limit a weave:Policy ; rdfs:label "Trade credit limit" ;
    rdfs:comment "A trade order may not push an account's balance above its credit limit (default £10,000)." .
ex:policy-price-change-dual-auth a weave:Policy ; rdfs:label "Price-change dual authorisation" ;
    rdfs:comment "Any price change must be countersigned by a second authoriser before publishing." .

# Governance edges (also asserted on each process in §6):
ex:process-goods-inward     weave:governedBy ex:policy-goods-inward-po-match .
ex:process-returns-refunds  weave:governedBy ex:policy-refund-approval-threshold .
ex:process-stock-management weave:governedBy ex:policy-quarterly-stock-count .
ex:process-customer-order   weave:governedBy ex:policy-trade-credit-limit .
ex:process-pricing-promotions weave:governedBy ex:policy-price-change-dual-auth .
```

---

## 12. Glossary & brand voice

Non-ontology content CE also seeds (glossary text and brand/voice individuals projected via CE-BRAND-1,
M2). Included here so the content is authored in one place.

**Brand voice.** Hammerbarn's tone is **friendly, practical and trade-savvy** — plain-speaking, never
corporate. It talks to a busy tradesperson or a weekend DIYer the same way: helpful, concrete, no jargon.
Copy prefers the imperative and the second person ("Grab a trolley, we'll sort the rest"). It is warm but
efficient — respects the customer's time, especially trade at the counter at 6:30am.

**Glossary (Hammerbarn terms):**

| Term | Meaning |
|---|---|
| Trade counter | The dedicated service point for trade-account customers, separate from consumer checkouts. |
| Click-and-collect | Order online, collect from the trade counter, usually within an hour. |
| Goods-in bay | The receiving area where supplier deliveries are booked in. |
| Core line | A top-selling product Hammerbarn commits to keeping in stock at all times. |
| Cycle count | A rolling partial stock count that reconciles a subset of SKUs without closing the store. |
| Reorder point | The stock level at which a StockItem triggers replenishment. |
| DC | Regional distribution centre that supplies a cluster of stores. |
| Put-away | Moving received goods from the goods-in bay to their storage/shelf location. |

---

## 13. Post-v1 content (STUBBED — not authored here)

The following are **stubs**. They land post-v1 and are authored by their owning engines' pipelines; this
brief only records what they will contain. Together they show the payoff of the §1 narrative: the Head
Office IT team's **digital estate** (§8) as live Build/Events artefacts, all grounded in this ontology —
generated apps (the Kitchen Designer is one example alongside the retail website/app, inventory management,
and loyalty estate) and the automations that operate them (pricing, delivery notifications, stock reorder).

- **Kitchen Designer app (Build — BE-ARTEFACT-1).** A generated example application — a customer-facing
  kitchen planner that lets a shopper lay out a kitchen from Hammerbarn's Product range and produce a
  costed StockItem list. It demonstrates a Build-generated app grounded in the seed ontology (Products,
  StockItems, prices). *Post-v1; not authored in this file.*
- **Example automations (Events — EA-AUTOMATION-1).** The canonical demo automation is
  **goods-inward → Slack**: when `ex:event-goods-received` fires, post a message to a store's Slack channel
  (the Events spec uses this exact flow as its demo). The automation runs as the
  `ex:actor-notification-service` principal (a `prov:SoftwareAgent`, per §7 / OQ-HB-6), never as a human
  identity. Plus a low-stock → reorder-draft automation. *Post-v1; not authored in this file.*
- **Example Build project.** The Build project record behind the Kitchen Designer — spec, generation
  provenance (BE-ARTEFACT-1 header, pinned CE version, referenced entity IRIs), and generated artefacts.
  *Post-v1; not authored in this file.*

---

## 14. Seed scope & milestone mapping

Which sections seed at which milestone. Ties to Onboarding EPIC-001's seed-lifecycle contract: the
**canonical** Hammerbarn graph is authored via **CE-WRITE-1** and published to the version-pinned named
graph **`weave:graph/v1.0.0`**; each onboarding user gets a **per-user writable fork** of that canonical
graph (reset only by explicit "Reset demo"). Sandbox writes never touch canonical data.

| Section | Content | Authored via | Milestone |
|---|---|---|---|
| §3–§11 | Domains, capabilities, goals, processes, actors, systems, data, vocabulary, policies | CE-WRITE-1 | **M1** |
| §12 | Glossary text; brand/voice individuals | CE-WRITE-1 (voice via CE-BRAND-1) | M1 seed / **M2** project |
| Explorer view of §3–§11 | Canvas exploration of the seed | consumed via CE-READ-1 / GE-CANVAS-1 | **M1** |
| Instance data (hundreds) | Concrete Product / StockItem / Order rows | CE-WRITE-1 (CE-TASK-005 pass) | **M2** |
| §13 Kitchen Designer | Generated example app | BE-ARTEFACT-1 | **post-v1** |
| §13 Automations | goods-inward → Slack, low-stock → reorder | EA-AUTOMATION-1 | **post-v1** |
| §13 Build project | Build project record + provenance | BE-ARTEFACT-1 | **post-v1** |

**Instance-data volume (OQ-HB-5 resolved: "realistic, hundreds").** M1 seeds the BPMO business brain (the
model: kinds, classes, processes) plus glossary. The **M2 instance-data pass (CE-TASK-005)** then generates
hundreds of concrete instances — a target of **~200–400 Products** and **hundreds of StockItem and Order
rows** across the 42 stores + 3 DCs. Enough to make Explorer and the search/canvas exercises feel real,
while staying legible on a user's first run (not tens of thousands).

M1 seed scope in one line: **the full BPMO business brain (§3–§11) plus glossary text (§12)**, published
canonical at `weave:graph/v1.0.0`, forked per user by Onboarding. Concrete instance rows (hundreds) land in
the M2 CE-TASK-005 pass; Build/Events content (§13) is deferred to post-v1.

---

## 15. Resolutions log

All open questions have been resolved by the human content owner. Nothing here is genuinely open; this is
kept as a decisions log.

- **OQ-HB-1 — Store & DC count. RESOLVED: 42 stores + 3 DCs (confirmed).** The M2 instance-data pass
  (CE-TASK-005) instantiates against this scale.
- **OQ-HB-2 — Multi-region modelling. RESOLVED: region is a plain field on Store, not a first-class
  entity.** `ex:field-store-region` on Store Records (§9), enumerated North / Midlands / South / Scotland /
  Wales, and referenced from `ex:class-store` (§10). No Region `weave:Actor` and no Region `weave:Class`.
- **OQ-HB-3 — £ thresholds. RESOLVED: refund approval = £50; trade credit-limit example = £10,000
  default.** Both confirmed and reflected in the §11 policies.
- **OQ-HB-4 — Tool & plant hire line. RESOLVED: dropped from the model.** Not a process; kept only as a
  one-line flavour mention in §2.
- **OQ-HB-5 — Instance-data volume. RESOLVED: realistic (hundreds).** ~200–400 Products and hundreds of
  StockItem / Order rows, generated by the M2 CE-TASK-005 pass (§14) — convincing in Explorer and the
  search/canvas exercises, still legible on first run.
- **OQ-HB-6 — Service-principal actors. RESOLVED: model automated actors as `weave:Actor` service
  principals.** `ex:actor-pricing-service` and `ex:actor-notification-service` (§7), typed
  `prov:SoftwareAgent`, attributed via `weave:performedBy` on the automated steps (§6.3, §6.5) and the
  post-v1 goods-inward automation (§13); distinct from human `prov:Person` actors, aligning with the
  Events engine's per-automation-principal / no-self-approval model.
- **OQ-HB-7 — Filename. RESOLVED.** The pointers in `engines/onboarding.md` (EPIC-001) and
  `personas.md` have been aligned to this file's name, `hammerbarn-content-brief.md`, chosen because
  the artefact is cross-engine (CE, Onboarding, Build) and matches the "Hammerbarn Content Brief"
  prose name used throughout the specs.
- **Enrichment (2026-07-06, content-owner input).** Added Hammerbarn's Head Office IT Systems / Digital
  team as the primary Weave audience and Technical-path protagonist (`ex:actor-head-office-it` +
  Manager/Solutions Architect/Software Engineer/Data Engineer, §7) and its digital estate (inventory
  management, retail app, delivery/logistics, pricing, loyalty, trade CRM, §8), wired to Build/Events (§13).

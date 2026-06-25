"""The comprehensive demo ontology shipped as the "Monsters, Inc." project.

It models the Monsters, Inc. universe as an enterprise architecture and spans
every node kind and relationship type so the canvas, glossary, and inventory
all have rich content on first run.
"""

DEMO_TURTLE = """
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix weave: <https://weave.dev/ontology#> .
@prefix res:   <https://weave.dev/resource/> .

#################################################################
# Business Domains
#################################################################

res:dom-energy-production
    a weave:BusinessDomain ;
    rdfs:label "Energy Production" ;
    rdfs:comment "The core revenue-generating domain responsible for converting harvested emotional energy into usable city power." ;
    weave:note "Reports directly to the office of the CEO; subject to municipal energy regulation." ;
    weave:color "#1f78b4" .

res:dom-scare-floor-operations
    a weave:BusinessDomain ;
    rdfs:label "Scare Floor Operations" ;
    rdfs:comment "Day-to-day operational domain that manages the scare floor, door logistics, and front-line monster activity." .

res:dom-child-safety-compliance
    a weave:BusinessDomain ;
    rdfs:label "Child Safety & Compliance" ;
    rdfs:comment "Governance domain ensuring all operations comply with Child Detection Agency (CDA) regulations and contamination protocols." ;
    weave:color "#e31a1c" .

res:dom-workforce
    a weave:BusinessDomain ;
    rdfs:label "Workforce" ;
    rdfs:comment "Human (and monster) capital domain covering scheduling, training, performance, and payroll." .

res:dom-rnd-laugh-program
    a weave:BusinessDomain ;
    rdfs:label "R&D / Laugh Program" ;
    rdfs:comment "Innovation domain pioneering the transition from scream-based to laugh-based energy harvesting." ;
    weave:note "Strategic initiative sponsored by senior leadership after the discovery that laughter yields 10x the energy of screams." ;
    weave:color "#33a02c" .

#################################################################
# Business Capabilities
#################################################################

res:cap-scream-harvesting
    a weave:BusinessCapability ;
    rdfs:label "Scream Harvesting" ;
    rdfs:comment "The legacy capability to extract and capture scream energy from children via door-based incursions." ;
    weave:inDomain res:dom-energy-production .

res:cap-laugh-harvesting
    a weave:BusinessCapability ;
    rdfs:label "Laugh Harvesting" ;
    rdfs:comment "The next-generation capability to collect laughter energy at scale, vastly outperforming scream yields." ;
    weave:inDomain res:dom-rnd-laugh-program ;
    weave:color "#b2df8a" .

res:cap-door-logistics
    a weave:BusinessCapability ;
    rdfs:label "Door Logistics" ;
    rdfs:comment "The capability to store, retrieve, route, and activate millions of closet doors linking the factory to children's bedrooms." ;
    weave:inDomain res:dom-scare-floor-operations .

res:cap-threat-detection
    a weave:BusinessCapability ;
    rdfs:label "Threat Detection (CDA)" ;
    rdfs:comment "The capability to detect, isolate, and remediate child-contamination events in line with CDA mandates." ;
    weave:inDomain res:dom-child-safety-compliance .

res:cap-employee-scheduling
    a weave:BusinessCapability ;
    rdfs:label "Employee Scheduling" ;
    rdfs:comment "The capability to roster scarers, assistants, and refinery staff against forecasted energy demand." ;
    weave:inDomain res:dom-workforce .

res:cap-canister-refining
    a weave:BusinessCapability ;
    rdfs:label "Canister Refining" ;
    rdfs:comment "The capability to compress, stabilise, and grade captured energy into distributable canister units." ;
    weave:inDomain res:dom-energy-production .

res:cap-energy-distribution
    a weave:BusinessCapability ;
    rdfs:label "Energy Distribution" ;
    rdfs:comment "The capability to deliver refined energy to the Monstropolis power grid and balance load during demand spikes." ;
    weave:inDomain res:dom-energy-production .

res:cap-performance-analytics
    a weave:BusinessCapability ;
    rdfs:label "Performance Analytics" ;
    rdfs:comment "The capability to measure scarer and comedian output, rank the leaderboard, and forecast yield." ;
    weave:inDomain res:dom-workforce .

#################################################################
# Systems
#################################################################

res:sys-scare-floor
    a weave:System ;
    rdfs:label "Scare Floor System" ;
    rdfs:comment "The flagship operational platform coordinating active scare stations across the factory floor." ;
    weave:inDomain res:dom-scare-floor-operations ;
    weave:hasCapability res:cap-scream-harvesting ;
    weave:dependsOn res:sys-door-vault ;
    weave:dependsOn res:svc-cda-monitoring ;
    weave:color "#6a3d9a" .

res:sys-door-vault
    a weave:System ;
    rdfs:label "Door Vault" ;
    rdfs:comment "Massive automated warehouse system storing the entire inventory of closet doors on overhead conveyor rails." ;
    weave:inDomain res:dom-scare-floor-operations ;
    weave:hasCapability res:cap-door-logistics ;
    weave:owns res:data-children-door-registry ;
    weave:note "Holds an estimated 6.5 million door units at peak season." .

res:sys-scream-refinery
    a weave:System ;
    rdfs:label "Scream Refinery" ;
    rdfs:comment "Industrial control system that processes raw scream energy into stabilised canister form." ;
    weave:inDomain res:dom-energy-production ;
    weave:hasCapability res:cap-canister-refining ;
    weave:dependsOn res:sys-scare-floor ;
    weave:owns res:data-scream-canister-ledger .

res:sys-laugh-power-grid
    a weave:System ;
    rdfs:label "Laugh Power Grid" ;
    rdfs:comment "Modern energy platform that captures, refines, and distributes laughter-derived power to Monstropolis." ;
    weave:inDomain res:dom-energy-production ;
    weave:hasCapability res:cap-laugh-harvesting ;
    weave:hasCapability res:cap-energy-distribution ;
    weave:dependsOn res:sys-scream-refinery ;
    weave:note "Commissioned after the Laugh Floor pilot proved laughter is a renewable, higher-density source." ;
    weave:color "#ff7f00" .

res:sys-cda-control
    a weave:System ;
    rdfs:label "CDA Control Center" ;
    rdfs:comment "Command-and-control system operated jointly with the Child Detection Agency for contamination response." ;
    weave:inDomain res:dom-child-safety-compliance ;
    weave:hasCapability res:cap-threat-detection ;
    weave:owns res:data-incident-reports .

res:sys-hr-platform
    a weave:System ;
    rdfs:label "Workforce Platform" ;
    rdfs:comment "Enterprise HR system of record for all monster employees, certifications, and shift history." ;
    weave:inDomain res:dom-workforce ;
    weave:hasCapability res:cap-employee-scheduling ;
    weave:owns res:data-employee-records .

#################################################################
# Services
#################################################################

res:svc-scream-collector
    a weave:Service ;
    rdfs:label "Scream Collector Service" ;
    rdfs:comment "Edge service that meters each scare event and captures raw scream energy from the canister intake." ;
    weave:inDomain res:dom-energy-production ;
    weave:realizes res:cap-scream-harvesting ;
    weave:partOf res:sys-scream-refinery ;
    weave:dependsOn res:sys-scare-floor ;
    weave:exposes res:data-scream-canister-ledger .

res:svc-laugh-collector
    a weave:Service ;
    rdfs:label "Laugh Collector Service" ;
    rdfs:comment "High-throughput service that captures laughter energy from the Laugh Floor comedy stations." ;
    weave:inDomain res:dom-rnd-laugh-program ;
    weave:realizes res:cap-laugh-harvesting ;
    weave:partOf res:sys-laugh-power-grid ;
    weave:color "#fdbf6f" .

res:svc-cda-monitoring
    a weave:Service ;
    rdfs:label "CDA Monitoring Service" ;
    rdfs:comment "Always-on detection service scanning scarers and doors for child-contamination signatures." ;
    weave:inDomain res:dom-child-safety-compliance ;
    weave:realizes res:cap-threat-detection ;
    weave:partOf res:sys-cda-control ;
    weave:exposes res:data-incident-reports ;
    weave:dependsOn res:svc-door-routing-api .

res:svc-employee-roster
    a weave:Service ;
    rdfs:label "Employee Roster Service" ;
    rdfs:comment "Service that builds and publishes daily scare and comedy rosters against forecasted demand." ;
    weave:inDomain res:dom-workforce ;
    weave:realizes res:cap-employee-scheduling ;
    weave:partOf res:sys-hr-platform ;
    weave:exposes res:data-employee-records ;
    weave:dependsOn res:svc-yield-analytics .

res:svc-door-routing-api
    a weave:Service ;
    rdfs:label "Door Routing API" ;
    rdfs:comment "API service that resolves a child target to a physical door and dispatches it from the vault to a station." ;
    weave:inDomain res:dom-scare-floor-operations ;
    weave:realizes res:cap-door-logistics ;
    weave:partOf res:sys-door-vault ;
    weave:exposes res:data-children-door-registry ;
    weave:dependsOn res:sys-door-vault .

res:svc-canister-inventory
    a weave:Service ;
    rdfs:label "Canister Inventory Service" ;
    rdfs:comment "Service tracking the location, charge level, and grade of every energy canister in circulation." ;
    weave:inDomain res:dom-energy-production ;
    weave:realizes res:cap-canister-refining ;
    weave:partOf res:sys-scream-refinery ;
    weave:exposes res:data-scream-canister-ledger ;
    weave:dependsOn res:svc-scream-collector .

res:svc-energy-dispatch
    a weave:Service ;
    rdfs:label "Energy Dispatch Service" ;
    rdfs:comment "Grid-facing service that releases refined energy to the city and manages load during power surges." ;
    weave:inDomain res:dom-energy-production ;
    weave:realizes res:cap-energy-distribution ;
    weave:partOf res:sys-laugh-power-grid ;
    weave:dependsOn res:svc-canister-inventory .

res:svc-yield-analytics
    a weave:Service ;
    rdfs:label "Yield Analytics Service" ;
    rdfs:comment "Analytics service computing the scare and laugh leaderboards and forecasting daily energy yield." ;
    weave:inDomain res:dom-workforce ;
    weave:realizes res:cap-performance-analytics ;
    weave:partOf res:sys-hr-platform ;
    weave:dependsOn res:data-scream-canister-ledger .

#################################################################
# Data Assets
#################################################################

res:data-scream-canister-ledger
    a weave:DataAsset ;
    rdfs:label "Scream Canister Ledger" ;
    rdfs:comment "Authoritative ledger of every canister filled, its source scare event, charge, and current owner." ;
    weave:inDomain res:dom-energy-production ;
    weave:describes res:concept-canister ;
    weave:describes res:concept-scream ;
    weave:describes res:concept-energy-crisis ;
    weave:color "#a6cee3" .

res:data-children-door-registry
    a weave:DataAsset ;
    rdfs:label "Children Door Registry" ;
    rdfs:comment "Registry mapping each closet door to a target child, location, and current vault position." ;
    weave:inDomain res:dom-scare-floor-operations ;
    weave:describes res:concept-door-station ;
    weave:describes res:concept-child ;
    weave:note "Highly sensitive; access restricted under CDA child-privacy rules." .

res:data-employee-records
    a weave:DataAsset ;
    rdfs:label "Employee Records" ;
    rdfs:comment "System of record for monster employees: roles, certifications, scare scores, and shift history." ;
    weave:inDomain res:dom-workforce ;
    weave:describes res:concept-monster ;
    weave:describes res:concept-scare .

res:data-incident-reports
    a weave:DataAsset ;
    rdfs:label "Incident Reports" ;
    rdfs:comment "Log of all contamination alerts, 23-19 declarations, and CDA decontamination actions." ;
    weave:inDomain res:dom-child-safety-compliance ;
    weave:describes res:concept-cda ;
    weave:describes res:concept-child ;
    weave:color "#fb9a99" .

res:data-laugh-yield-log
    a weave:DataAsset ;
    rdfs:label "Laugh Yield Log" ;
    rdfs:comment "Time-series log of laughter energy captured per comedy station, used to benchmark against scream yields." ;
    weave:inDomain res:dom-rnd-laugh-program ;
    weave:describes res:concept-laugh ;
    weave:describes res:concept-energy-crisis .

#################################################################
# Fields (partOf Data Assets)
#################################################################

res:field-canister-id
    a weave:Field ;
    rdfs:label "Canister ID" ;
    rdfs:comment "Unique serial identifier stamped on each energy canister." ;
    weave:partOf res:data-scream-canister-ledger .

res:field-charge-level
    a weave:Field ;
    rdfs:label "Charge Level" ;
    rdfs:comment "Measured energy charge held in a canister, expressed in scream-units." ;
    weave:partOf res:data-scream-canister-ledger ;
    weave:describes res:concept-energy-crisis .

res:field-door-target-child
    a weave:Field ;
    rdfs:label "Target Child" ;
    rdfs:comment "Reference to the child a given door currently connects to." ;
    weave:partOf res:data-children-door-registry ;
    weave:describes res:concept-child .

res:field-employee-scare-score
    a weave:Field ;
    rdfs:label "Scare Score" ;
    rdfs:comment "Rolling performance metric ranking a monster's scream-generating effectiveness." ;
    weave:partOf res:data-employee-records ;
    weave:describes res:concept-scare .

res:field-incident-code
    a weave:Field ;
    rdfs:label "Incident Code" ;
    rdfs:comment "Classification code for a contamination event, e.g. the infamous 23-19." ;
    weave:partOf res:data-incident-reports ;
    weave:describes res:concept-cda .

res:field-laugh-volume
    a weave:Field ;
    rdfs:label "Laugh Volume" ;
    rdfs:comment "Captured laughter intensity per comedy set, in decibel-laugh units." ;
    weave:partOf res:data-laugh-yield-log ;
    weave:describes res:concept-laugh .

#################################################################
# SKOS Glossary (Concepts)
#################################################################

res:concept-energy
    a skos:Concept ;
    rdfs:label "Energy" ;
    rdfs:comment "The harvested emotional power that fuels the city of Monstropolis." ;
    skos:narrower res:concept-scream ;
    skos:narrower res:concept-laugh ;
    weave:note "The top-level concept under which both legacy and modern power sources sit." .

res:concept-scream
    a skos:Concept ;
    rdfs:label "Scream" ;
    rdfs:comment "Emotional energy released by a frightened child; the legacy power source." ;
    skos:broader res:concept-energy ;
    skos:related res:concept-scare ;
    skos:related res:concept-canister .

res:concept-laugh
    a skos:Concept ;
    rdfs:label "Laugh" ;
    rdfs:comment "Energy released through laughter; ten times more potent than a scream." ;
    skos:broader res:concept-energy ;
    skos:related res:concept-child ;
    weave:color "#cab2d6" .

res:concept-scare
    a skos:Concept ;
    rdfs:label "Scare" ;
    rdfs:comment "A deliberate act by a monster to frighten a child and release scream energy." ;
    skos:related res:concept-scream ;
    skos:related res:concept-monster ;
    skos:broader res:concept-door-station .

res:concept-door-station
    a skos:Concept ;
    rdfs:label "Door Station" ;
    rdfs:comment "A scare-floor workstation where an activated door links the factory to a child's bedroom." ;
    skos:related res:concept-door ;
    skos:narrower res:concept-scare .

res:concept-door
    a skos:Concept ;
    rdfs:label "Door" ;
    rdfs:comment "A physical closet door functioning as a portal to a specific child's room." ;
    skos:related res:concept-door-station ;
    skos:related res:concept-child .

res:concept-monster
    a skos:Concept ;
    rdfs:label "Monster" ;
    rdfs:comment "An employee of the factory; may serve as a scarer, comedian, or assistant." ;
    skos:related res:concept-scare ;
    skos:related res:concept-child .

res:concept-child
    a skos:Concept ;
    rdfs:label "Child" ;
    rdfs:comment "A human child on the other side of a door; the source of harvestable energy." ;
    skos:related res:concept-cda ;
    skos:related res:concept-door .

res:concept-canister
    a skos:Concept ;
    rdfs:label "Canister" ;
    rdfs:comment "A sealed vessel storing refined scream or laugh energy for distribution." ;
    skos:related res:concept-scream ;
    skos:related res:concept-laugh ;
    skos:broader res:concept-energy .

res:concept-cda
    a skos:Concept ;
    rdfs:label "CDA (Child Detection Agency)" ;
    rdfs:comment "The regulatory and rapid-response agency governing child-contamination events." ;
    skos:related res:concept-child ;
    skos:related res:concept-scare ;
    weave:color "#e31a1c" .

res:concept-energy-crisis
    a skos:Concept ;
    rdfs:label "Energy Crisis" ;
    rdfs:comment "The strategic shortage of scream energy driving the shift toward laughter." ;
    skos:related res:concept-power-surge ;
    skos:broader res:concept-energy .

res:concept-power-surge
    a skos:Concept ;
    rdfs:label "Power Surge" ;
    rdfs:comment "A sudden spike in grid load or canister output requiring active dispatch balancing." ;
    skos:related res:concept-energy-crisis ;
    skos:broader res:concept-energy .

#################################################################
# OWL Classes
#################################################################

res:class-energy-source
    a owl:Class ;
    rdfs:label "Energy Source" ;
    rdfs:comment "The class of all phenomena from which the factory can extract usable energy." ;
    weave:note "Members include scream- and laugh-based sources; modelled as an OWL class for inference." .

res:class-regulated-asset
    a owl:Class ;
    rdfs:label "Regulated Asset" ;
    rdfs:comment "The class of data assets and systems subject to CDA child-safety governance." ;
    weave:describes res:concept-cda .
"""

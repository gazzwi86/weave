

## Navigation

Weave
    Dashboardboard: the home page with a dashboard of recent activity, metrics and user specifc information.
    Ontology & Data
        Explore: A space to explore the entire ontology and data
        Query: A space to query the ontology in SparQL or NL which can be translated to SPARQL
        Mapping: Manage the the mappings between data and the rules and processes that generate, manage, mutate and read them
        Rule: The extracted rules seen in the ontology, offering an alternative visual means of understand, reading, and creating the rules that govern the system.
        Glossary: A glossary of theshared terms in the company and ontology
        Org chart: A chart of the people, their role and their relationships, hieracical data and contect details, derived from integrations with SSO systems, workday (et-al) and used to map domains, capabilities, processes, application owners etc to the related items in the onotology.
    Build
        Project
            Spec: create and edit the spec for the project directly and in collaboaration with agents like a PO, architect etc agent
            Project management: a graph and kanban view of the project
            Project level onotology: a view into the ontology regarding this project specifically, its relationship to other systems and a chance to add the ontological information and low level detail for this project, derived in part from the spec if it exists.
            Issues
            Settings: Space to setup intgrations, slack channels, users/contributors etc
    Actions: A space to manage automations that are based on events that occur in the system. Effectively leveraging the ontology, the documented processes, and use the events they document and the integrations to monitor the associated events and trigger some sort of action eg. when a delivery of products arrives at store x then the store manager at store x should be notified via slack
    Compliance: A space to leverage the ontology to ensure the weave, and integrated systems, built applications etc are all compliant with the ontology
        Check: Tools for testing if the apps, agents, automations, systen, data, integration implementations (aws, servicenow) etc are configured appropriately and aligned with the ontologies rules.
        Logs: Audit trail/log for whole system
    Self-improvement: A space where the system improves it self using an agent to inspect logs, outputs, deliverables etc and find improvements to how the system runs.
    Questionaires: A space to create questionaires and interviews that can be used to eclicit and extract information regarding the company and the system, with the information used to dervice and establish the ontology.
    Settings

## Information archiotecture for a workspace / ontology

> The below would be in addition to or composed within the onotology with relevant views in for convenience.

Workspace / company
    branding & tone of voice
    
    Obligation & Constraints eg regulation, tech stack (aws)

    principle
    
    aim
    
    Initiative
        Product/Project management graph
            Branding & tone of voice
            Epic
            Task

    domains
        capabilities
    
    Assets
    
    Business processes
    
    Data: a data model, semantic model, in the c4 style and rich in links, descriptions, taxonomies glossary, etc. It should have links to the resources, schemas, dbs, colums etc themselves, and the source systems, including those that consume them.
        Systems/Context
        Containers/Bronze
        Components/Silver
        Code/Gold

    Glossary
        Links to resources/assets/code bases to avoid confusion as to what is being referred to
    
    Service catalog: an architectural view in the C4 model. rich in links, descriptions, taxonomies glossary, etc. It should have links to the resources, code repos etc themselves and the source systems, including those that consume them.
        Systems/Context (eg c4 model)
            Containers
                Components
                    Code

    Resources
        Knowledge base
        Module & pattern kit


## Tour / Demo

The system needs a demo and entry example, a training mechanism for new users. There should be a demo organisation that we can tour and give users a explained example of what why how you use the system
As such you should start in a demo client/workspace.
The company we model should be called "hammerbarn", a fake version of bunnings, taken from the kids tv show bluey.
The ontology, compliance, constitiution etc derived should be based on bunnings, and draw on similar companies like kingfisher B&Q, whom i used to work for so could help enlighten things a little.
We would be build in the tour via the dark factory an app for a quick 2d simulated design for a kitchen. You can choose from different skus lay out in 3 different kitchens, gully thin, l shaped and large retangular kitchens, able to pick between a bunch of different skus and see them represented in the design.

## Questionaires and interviews

I think hosted questionaires, and interactive interview agents will need to be hosted in the platform. Why? No small part of establishing this ontology is going to be based on tribal knowledge, the information that existin in company members heads. Being able to send out questionaires, and also pull people into agent sessions that interactievly interview them about the company, would help fill in blanks. The generation of a questionaire and the natuire of the questions asked by the interview agent would need to take into consideration the nature of the system/ontology already documented.

I would also need to think logically about what and how it is to develop this ontology. the diagrams and detail required, to best inform the sequencing of questions and build complexity and knowledge as you go.

It will also need a mechanism to consume the data gathered and move it into the ontology, developing a claude code style plan that is easy to parse by a human, full of diagrams, and visual explainations where possible as well as bullet points.

The system will also have to consider conflicting requests and infirmation or mis understoof nouns or terms that are mixed in the glossary.
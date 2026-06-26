## Watching (projects etc), notifications and emails

The system needs a notifications engine. This is for notifcations to do with the platform, eg being invited to projects, notified of projects, ontology sections youre watching, but also HITL stage gates. No small part of this tool is long running automated agents and automations that will require HITL feedback and approvals at various points. There needs to be a notifications page and a notification mechansm, perhap also including emails to notifiy you of notifications and activity in the system, like the atlasian confluence notification and roundup emails, or the same in notion.

## Additional features

Having an glean like enterprise search capability, with index Graph RAG (contextual rag or similar) would be beneficial. It should be able to index and retirve useful context over time throughout the organisation and put it to use in any of the features, but especially when buildint the ontology.

However, the idea of building this seems difficult lrge and daunting, it might be better to integrate with a tool like glean and leverage it in the tool to enterprise search

## Ontology extraction

Logs in the various integatrated systems owuld show a good deal of the processes that go on, and the human actions that take place in the system, this would be a good way to establish the ontology in part, initially.

## Integrations

The system will have to integrate with a bunch of different systems to execute actions and consume artefacts to build the ontology.

There will need to be a setting page at the weave level to setup the integrations, and then build project, or actions level configurations so that the project or action can target specific boards, projects, accounts etc of the integrations configured at the top level.

Integrations include:

- Slack (maybe lower value?)
- Github
- Atlassian (Confluence & Jira)
- AWS
- SnowFlake
- Salesforce (or alternative CRM)
- ServiceNow

The above can be expanded on, but we need a popular well adotped initial target that shows the value of this platform.

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

## Dark factory / Long running harness agents

ApproachBuild the harness with AI generated prompts and then refine prompts and harness when using it in anger
Init
Exec ceo - establishes a company constitution by orchestrating the below, the aim being to establish a set of document that articulate the existing ecosystem and the rules that govern it, the constraints and considerations that should be applied to all of the 
	Exec operations - establishes a company constitution, capabilities, 
	Exec data - data catalog/marketplace, data governance rules, data representations/docs
	Exec product - product catalogue
	Exec CSRO - eg. security principles, regulatory requirements
	Exec CTO - establishes a company arch view eg. service inventory, technical constraints, identity rules
Evaluator/consultant - assess the above constitution and suggest improvements and remediation, look for gaps that a agent that would plan or implement a product may find, the pitfalls that might reduce effectiveness.
Planning
Orchestrator - a agent for managing the main session
Product owner - plans and designs the product needs and features
Technical architect - designs high and low level solution details
Security Analyst - assesses the plan from a security lens
Technical Business Analyst - knows the company constitution and can analyse the design and product proposal accordingly
SME - some domain expert, relevant to the product, that can assess the plan

Delegation loop - a ralph loop of sorts
Principle engineer - gathers context needed, delegates to relevant agents or agent teams using parallel agents when it can, plans the tasks and delegates it amongst and agent team as needed, orchestrates between team as needed, inits the repo, the claude config, git hooks etc
Implementor - a code writer, for all but frontend, eg. devops, observability, analytics, pipelines, IaC, api implementation, configuration, state management in app, databases, middleware, etc
Frontend - implements the design system, writes frontend code against the design.md spec, plans the components needed, design system, composition etc. Only creates frontend, no state based logic
QA - runs and writes tests, checks the DoD, checks the task completeness against the task requirements, the relevant documentation
Security - reviews the code for security improvements and rigour
Evaluator - uses playwright for exploratory testing
Claude specialist - assess session finding and refine the project level harness
Technical docs writer - writes up the documentation for the implemented portion plus session summary
Designer - visual assessment of the frontend
Assess:
Council: PO, TBA, SME, Architect - assess the output/outcome and suggest remediations at the end of each phase
Codify
Polaris - outer harness improver, looks a logs, council findings, human feedback etc and suggests improvements to the harness, constitution, etc

Ops
Principle engineer - plans the tasks and delegates it amongst and agent team as needed
Assessor - receives outage alarms/events, looks at logs on a schedule, creates bugs for human approval
	Assessor Eval council - assess created bug before human approval, borrows the above planning cohort shape
Implementor - picks up and implements a fix for a human approved bug
	Eval council - assess the fix before human approval to harden


Features
- Company level memories
- Project level memories
- Immutable audit trail
- Smaller models have a option high power advisor
- hooks.py
- stop hook to check completeness etc
- pretool use secrets scanning
- session start memory injection
- Claude subagents and loops, via `claude -p`, can be initialised within a sub-directory - this allows for more refined context isolation and would need to chosen by the orchestrator/stop hook only when a job is isolated of other folder needs and would benefit from better focus or context isolation
- stop hook to reflect and propose updates to CLAUDE.md, **/CLAUDE.md or .claude/rules updates. Could write to .claude/reflections/<task-related-name>.md
- stop hook to check the job, task is successfully complete

Skills / Commands
- Analyse logs - find log entries pertaining to issues regarding the harness itself and perform root cause analysis, may use a cli tool to help
- Constitution - To be decomposed
- Orchestration - might be better in the Claude.md for the sdk/harness
- Brownfield
    - Anatomy
- Plan
- Open PR
- HITL gateway??
- Design system
- UI development
- Web development
- API development
- IaC development
- CI/CD development
- Technical Document Writing / Diagramming
- Testing UI
- Testing API
- Testing Infra
- Testing security
- Code Review
- Claude configurator
- Brief / PRD / Roadmap / Requirements / Epics / Tasks / DoD
- HLD / LLD - To be decomposed
- Analyse logs
- Create bugs
- Harness development eg Polaris 
- Session summary - write the .claude/summaries/SESSION_<X>.md
- Council - write to the .claude/reports/<X>_REPORT.md
- Elicitation - 20 questions etc
- /simplify /review /security-review - use the anthropic natives
- cc-audit
- githooks

MCPs/Plugins
- Playwright
- AWS / Azure
- Context7
- Graphify
- jcodemunch
- Terraform
- Anthropic superpowers
- Microsoft docs
- Github / Gitlab
- typescript/pyright/swift/java/kotlin lsp
- agent-sdk-dev
- Look into: serena / Feature-dev / frontend / claude md management / security guidance / claude code setup? 

What about pair programming? What if we had a pair of implementors, collaborating on a goal, each helping and assessing each others plans, approaches and incremental and complete implementations as they go, using the claude teams capability to communicate in isolated context windows and chat between each other.
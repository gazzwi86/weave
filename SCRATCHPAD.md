# Ideas & feedback

The below should be planned by Fable and executed with a cost efficient model like claude-sonnet-5 as a sub-agent, unless otherwise specified. Fable or opus can review the outcome delivered by the sub agent. 

- Can we create a lean canvas in a sub section of the CE. It should be a defined UI, competitiors, okrs, channels, etc, the common 11 lean canvas entities that form a strategy on a page for an org. The entities in the columns are powered by Googles OKF wiki format. This way in the ui, you can have an entity like a channel eg web, and then when clicked it can open a modal which has the okf markdown file giving a full detailed explination.

- Ontology meets Google OKF - the entities listed in the ontology are simple concepts, thin definitions without documentation and explination. Can we use the OKF and markdown to add documentation for them. Then when you click in the graph onto a concept, it can feature not only the SKOS glossary definitions but a detailed explination for the entity in the right hand aside. This would mean the OKF frontmatter types and other metadata will have to map neatly onto the URI, concept etc. But it should allow for in depth documentation of items beyon just the simple releationships. Im not sure how it fits with the BPMO though, where there would be overlap, conflicts or duplicate/overlapping documentation, it could be wasteful.

- Need to add ask in settings.json for updating the harness, updating the spec, during the implement phase only. Eg. ask if write(docs/specs/weave/*)

- There should be a force compact of the orchestrator at the end of each epic.

- The index needs to be a promotion brochure for the application, SaaS style, pushing to pricing, privacy, compliance, etc info with a buy and Sign up/buy buttons.

- Need to alter the 5-persona review to include design/user experience - a user expert, rather than the user themselves, or a hybrid of the two. Visual ui, navigation, infor arch, usability, aestehtics all shoul be reviewed by this persona

- Request application: this will have to be part of the Projects sidebar. The prompt to application should use something like this projects harness in terms of the loop, the agents, the quality gates like linting, prs, phases, 5 persona councils etc.

- The Anthropic Agent SDK should be used for the agents in the application, this is so I can manage the prompts, agents etc asthough it was a claude harness, similar to what is seen in this repo. The aim is to have a simple way for us to manage (in code for now) the buils agent workflow (which should mirror the .claude folder flow eg. po, architect, implement, qa, the skills, hooks, the workflow/loop) and we should be able to easily update prompts, update the workflow, for example adding a design agent. See the reports .claude/reports for analysis and the for an idea of the configurability we are planning to work on https://github.com/coleam00/archon

- Query the graph: this needs an explore style page so you can switch between a text based response and a graph based version of the data returned.

- The appear in the dashboard - they are not needed:
    "View billing usage"
    "View audit compliance"

- Need to work on a notifcations spec. HITL from project builds, 

- Super admin see the self-improvement engine details, issues, and findings from the logs that can be used to describe tasks, updates etc that can improve the system then the build engine can open a PR. The CI/CD would deploy a new version of the app after human approval of the approval of the pipeline with pushes to prod


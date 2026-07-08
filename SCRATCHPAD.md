# Feedback

The below should be planned by Fable and executed with a cost efficient model like claude-sonnet-5 as a sub-agent, unless otherwise specified. Fable or opus can review the outcome delivered by the sub agent. 

- Need to add ask in settings.json for updating the harness, updating the spec, during the implement phase only. Eg. ask if write(docs/specs/weave/*), write(.claude/scripts/*), write(.claude/agents/*), write(.claude/commands/*), , write(.claude/skills/*), write(.claude/settings.json), write(.claude/rules/*), write(.claude/spec-templates/*)

- There should be a force compact of the orchestrator at the end of each epic. Can this be done via a hook?

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

- http://localhost:3000/ce - looking here, the manual adding of items doesnt see created included or functional, only the NL. There was supposed to be a form for creating things in the ontology/bpmo.

- I think we need to move to v1 faster and deliver this hammerbarn example. It will help me alot to play and understand the application. We need to refine the spec to merge m2 and v1 and deliver both together.

- http://localhost:3000/ce I asked: "build a capability in the hosted/housed in the company hq (location) who deliver/deploy/mange/operate the retail ecommerce website, which will in future have associated with it data, processes and systems/apis etc" I got "I'm not sure what you mean -- could you rephrase that more specifically?". Even when using "batiai/qwen3.6-27b:iq3". Are we unlikely to have a powerful enough local model to execute a task in this ui, or is the hanress, context or similar impeding this?
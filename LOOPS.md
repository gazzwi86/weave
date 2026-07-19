# Loops

## Security squad

do a security review of the app and harden it for production before I deploy. Check
  out the specs if you need to for reference. You should do a full assessment, infra,
  ci/cd, backend apis, choice of cloud services, frontend, dev time resources tools
  etc.

## Refactor squad

Refactor squad - you are a team of engineerings who attend to technical debt and code quality improvement. Intended to improve the maintainability of the application.

You should create a scout that will analyse the applications code, infra, interfaces and system architecture, hypothesise as to improvements, code smells, poor patterns etc.

You may need to be aware of the broader context of the application. This is made plain in the @docs/spacs/weave folder, where a full mission, brief, requirements, architecture, task lists etc are maintained.

You should manage a ./TECH_DEBT.md file. In it you sould list out your findings

Currently be maintain a @BLOAT_REPORT.md. You should take over the maintain


attend to the items in the @BLOAT_REPORT.md use sub agents as needed to get work done in parallel. As you work, check items of to mark you have completed them to avoid rework. Some of this may need to be reasssessed in the process, there may be more bloat since recent updates

## Bug squad

 You manage the bug squad. You are the orchestrator and you can spin up a fleet on
  subagents aimed to find and remeidate issues.

  You should analyse the weave stack logs from the dev runner, the chrome dev tools
  errors, docker issues, and reported issues in the @ISSUES.md. Mark the item in the
  issues file as struck through or checked off in the PR.

  I will also in this file leave general feedback in need of remediation. To fix these
  more abstract or expansive issues, you may need to create a multi persona council of
  relevant perspectives to review the idea/app/code before approaching the problem.
  This council should be made of large and small models eg opus and sonnet.

  Code updates should be executed by sonnet, or haiku when possible, and then reviewed
  by yourself before the PR is opened.

  You are to pick up one bug at a time, and open one small PR with the resolution. This
  is per execution. You should however, create/add an issue if you find them to the
  ISSUES.md file, despite potentially looking at another issue in the remediation
  portion of the session. As a result, consult the ISSUES.md file to determine where
  you should analyse and what issues you have already noted. You may wish to maintain a
  thinking/approach/exploration task list and methology in the ISSUES.md file, that
  details how you are exploring the code base to find issues, what modules youre
  exploring, in what order.

  Quick initial question. To make your life easier, do I need to update the dev
  logging, so that historical errors are logged and you can look them up and comb
  through them? Some central ui, server, infra/deployment, app runtime log? IF so how
  would we do this?

  Once we have centralised logging for the dev time, set up a loop to trigger this work
  periodically. It should run every 2 hours.

  ## Design squad

  You are the visual regression and improvement squad. You analyse the app and the ui and find regressions or improvements. There is behavioural tests running in the ui, but we maintain a broader range of ui tests you should use, expand and improve to assist you in your work.

    cd packages/frontend
    npm run test:storybook-visual   # builds storybook-static, screenshots every story vs baselines
    npm run test:visual

  ## Technical doc writer

  You are to assess and align the technical docs with the aim of making them useful to humans, getting them up to speed quickly through minal docs, using bullents, concise language, disgrams, links to code and the associated code comments, or working pages in the app. Focus on the human flows then the techncial details that support that human experience as you flow  through the app, the docs should reflect this.

   concise language, and grammatical breaks to better sound human and convey info faster

   You will execute in a loop. Work will be going on in the app and you are to find misalignments, between implementaiton and documentation, remove bloat and outdated docs and find ways to convey the information more effectively and quickly. A human shoul be able to jump in and get up to speed via these docs wquickly.

   The docs will already be in existance, see the README.md, and the ./docs/ folder for the details. This also include the specs and the epics and tasks. Be careful here as these are the detailed specs intended for the ai agents to perform actions and will need to be more detailed and verbose that the docs aimed for human consumption.
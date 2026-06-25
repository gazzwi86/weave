# Scout Plan

Generated: {date}
Graph metrics: {nodes} nodes · {edges} edges · {clusters} clusters · largest cluster {max_cluster} · graph.json {size}
Triggered by: {thresholds that matched, e.g. "nodes > 500, clusters > 6"}

This plan lists the focused investigations an orchestrator (typically the Architect agent) should delegate to Scout subagents rather than research directly. Each entry maps to a single-domain investigation with a bounded scope.

When the Architect's work spans more than 3 of these domains, Law 11 requires spawning one Scout per domain via the Agent tool. See `skills/scout/SKILL.md` for the Scout contract and output template.

## Domains

### {domain-id}

- **Cluster:** {community name or ID from graph.json}
- **Node count:** {N}
- **Representative nodes:** `{node-id-1}`, `{node-id-2}`, `{node-id-3}`
- **Scope question:** {focused question the scout should answer — e.g. "What authentication mechanisms exist, which files implement them, and what are the entry points?"}
- **Output path:** `.claude/state/context/scouts/{domain-id}.md`
- **Line budget:** 200

<!-- Repeat one block per top-level cluster. For any cluster > 150 nodes, split it into
     multiple domain entries (by sub-cluster, file-path prefix, or responsibility area)
     and name each split explicitly. -->

## Notes

- Scouts write ONLY to their `output_path` and return a short pointer. They never return raw source.
- Cross-domain questions (e.g. "how does auth interact with the data layer?") remain the orchestrator's job after scout outputs are available.
- If a domain's scope question cannot be answered from the listed nodes alone, the scout must list open questions rather than expand scope unilaterally.

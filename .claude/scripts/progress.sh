#!/bin/bash
set -e
# Weave Progress State Manager
# Reads and writes .claude/state/progress.json
# Usage: progress.sh <command> [args]
#
# Commands:
#   init <project-name>          Initialize progress.json
#   add-epic <id> <title>        Add an epic
#   add-task <id> <epic> <title> Add a task to an epic
#   update <task-id> <status>    Update task status (backlog|in_progress|review|done)
#   next                         Get next task in backlog
#   ready                        Get tasks whose dependencies are all satisfied
#   kanban                       Display kanban board
#   phase-check                  Check if current phase is complete
#   epic-check <epic-id>         Check if an epic is complete (sets epic status=done when so)
#   list [status]                List tasks, optionally filtered by status
#   graph                        Display dependency graph

STATE_FILE=".claude/state/progress.json"

# Ensure node is available
if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found. Install Node.js first." >&2
  exit 1
fi

# Ensure state file exists
ensure_state() {
  if [ ! -f "$STATE_FILE" ]; then
    echo "Error: $STATE_FILE not found. Run /harness-init first." >&2
    exit 1
  fi
}

# Initialize progress.json
cmd_init() {
  local project="${1:-unnamed}"
  mkdir -p "$(dirname "$STATE_FILE")"
  cat > "$STATE_FILE" <<INIT
{
  "project": "$project",
  "phase": "init",
  "epics": [],
  "tasks": []
}
INIT
  echo "Initialized progress for: $project"
}

# Add an epic
cmd_add_epic() {
  ensure_state
  local id="$1" title="$2"
  if [ -z "$id" ] || [ -z "$title" ]; then
    echo "Usage: progress.sh add-epic <id> <title>" >&2; exit 1
  fi

  ITEM_ID="$id" ITEM_TITLE="$title" STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const id = process.env.ITEM_ID, title = process.env.ITEM_TITLE;
    if (!data.epics.find(e => e.id === id)) {
      data.epics.push({ id, title, status: 'backlog' });
      fs.writeFileSync(process.env.STATE, JSON.stringify(data, null, 2));
      console.log('Added epic: ' + id + ' - ' + title);
    } else {
      console.log('Epic ' + id + ' already exists');
    }
  "
}

# Add a task
cmd_add_task() {
  ensure_state
  local id="$1" epic="$2" title="$3" blocked_by="${4:-}"
  if [ -z "$id" ] || [ -z "$epic" ] || [ -z "$title" ]; then
    echo "Usage: progress.sh add-task <id> <epic> <title> [blocked_by_csv]" >&2; exit 1
  fi

  ITEM_ID="$id" ITEM_EPIC="$epic" ITEM_TITLE="$title" ITEM_BLOCKED="$blocked_by" STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const id = process.env.ITEM_ID, epic = process.env.ITEM_EPIC, title = process.env.ITEM_TITLE;
    const blocked_by = process.env.ITEM_BLOCKED ? process.env.ITEM_BLOCKED.split(',').filter(Boolean) : [];
    if (!data.tasks.find(t => t.id === id)) {
      data.tasks.push({ id, epic, title, status: 'backlog', blocked_by });
      fs.writeFileSync(process.env.STATE, JSON.stringify(data, null, 2));
      console.log('Added task: ' + id + ' - ' + title);
    } else {
      console.log('Task ' + id + ' already exists');
    }
  "
}

# Update task status
cmd_update() {
  ensure_state
  local id="$1" status="$2"
  if [ -z "$id" ] || [ -z "$status" ]; then
    echo "Usage: progress.sh update <task-id> <status>" >&2; exit 1
  fi

  ITEM_ID="$id" ITEM_STATUS="$status" STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const id = process.env.ITEM_ID, status = process.env.ITEM_STATUS;
    const task = data.tasks.find(t => t.id === id);
    if (task) {
      task.status = status;
      fs.writeFileSync(process.env.STATE, JSON.stringify(data, null, 2));
      console.log('Updated ' + id + ' -> ' + status);
    } else {
      console.error('Task ' + id + ' not found');
      process.exit(1);
    }
  "
}

# Get next backlog task (scoped to the current phase's engine when tasks carry an engine field)
cmd_next() {
  ensure_state
  STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const engine = (data.phase || '').split('/')[0];
    const scoped = data.tasks.some(t => t.engine)
      ? data.tasks.filter(t => !t.engine || t.engine === engine)
      : data.tasks;
    const next = scoped.find(t => t.status === 'backlog');
    console.log(next ? next.id : 'NONE');
  "
}

# Display kanban board
cmd_kanban() {
  ensure_state
  STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));

    const cols = { backlog: [], in_progress: [], review: [], done: [] };
    data.tasks.forEach(t => {
      const col = cols[t.status] || cols.backlog;
      col.push(t.id + ' ' + (t.title || '').substring(0, 20));
    });

    const maxRows = Math.max(...Object.values(cols).map(c => c.length), 1);
    const pad = (s, n) => (s || '').padEnd(n);

    console.log('Project: ' + data.project);
    console.log('Phase: ' + data.phase);
    console.log('');
    console.log(pad('Backlog', 20) + '| ' + pad('In Progress', 20) + '| ' + pad('Review', 20) + '| Done');
    console.log('-'.repeat(20) + '+-' + '-'.repeat(20) + '+-' + '-'.repeat(20) + '+-' + '-'.repeat(20));

    for (let i = 0; i < maxRows; i++) {
      const row = [
        pad(cols.backlog[i], 20),
        pad(cols.in_progress[i], 20),
        pad(cols.review[i], 20),
        pad(cols.done[i], 20)
      ];
      console.log(row.join('| '));
    }

    const total = data.tasks.length;
    const done = cols.done.length;
    console.log('');
    console.log('Epics: ' + data.epics.filter(e => e.status === 'done').length + '/' + data.epics.length + ' complete | Tasks: ' + done + '/' + total + ' complete');
  "
}

# Check if current phase is complete.
# Tasks may carry an "engine" field; the phase field is "<engine>/<phase-label>". When engine
# fields exist, only the current engine's tasks count — so the gate fires at each ENGINE
# boundary (the engine-end HITL stop), not only when every task in the file is done.
cmd_phase_check() {
  ensure_state
  STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const engine = (data.phase || '').split('/')[0];
    const scoped = data.tasks.some(t => t.engine)
      ? data.tasks.filter(t => !t.engine || t.engine === engine)
      : data.tasks;
    if (scoped.length === 0) {
      console.log('INCOMPLETE: phase ' + data.phase + ' has no tasks registered');
      process.exit(0);
    }
    const incomplete = scoped.filter(t => t.status !== 'done');
    if (incomplete.length === 0) {
      console.log('COMPLETE');
    } else {
      console.log('INCOMPLETE: ' + incomplete.length + ' tasks remaining');
      incomplete.forEach(t => console.log('  ' + t.id + ' [' + t.status + '] ' + t.title));
    }
  "
}

# Check if a single epic is complete (mirrors phase-check, filtered by epic).
# Prints COMPLETE iff zero non-done tasks in the epic, else INCOMPLETE: N remaining.
# On completion, also flips the epic's own status to 'done' (the kanban reads epics[].status
# but nothing else sets it).
cmd_epic_check() {
  ensure_state
  local epic="$1"
  if [ -z "$epic" ]; then
    echo "Usage: progress.sh epic-check <epic-id>" >&2; exit 1
  fi
  ITEM_EPIC="$epic" STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const epic = process.env.ITEM_EPIC;
    const tasks = data.tasks.filter(t => t.epic === epic);
    if (tasks.length === 0) {
      console.error('Epic ' + epic + ' has no tasks (or does not exist)');
      process.exit(1);
    }
    const incomplete = tasks.filter(t => t.status !== 'done');
    if (incomplete.length === 0) {
      const e = data.epics.find(e => e.id === epic);
      if (e) e.status = 'done';
      fs.writeFileSync(process.env.STATE, JSON.stringify(data, null, 2));
      console.log('COMPLETE');
    } else {
      console.log('INCOMPLETE: ' + incomplete.length + ' remaining');
      incomplete.forEach(t => console.log('  ' + t.id + ' [' + t.status + '] ' + t.title));
    }
  "
}

# List tasks
cmd_list() {
  ensure_state
  local filter="$1"
  FILTER="$filter" STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    let tasks = data.tasks;
    const filter = process.env.FILTER;
    if (filter) tasks = tasks.filter(t => t.status === filter);
    tasks.forEach(t => console.log(t.id + ' [' + t.status + '] ' + t.epic + ' | ' + t.title));
  "
}

# Get tasks whose dependencies are all satisfied (scoped to the current phase's engine when
# tasks carry an engine field — a later engine's tasks are never "ready" before its phase starts)
cmd_ready() {
  ensure_state
  STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const engine = (data.phase || '').split('/')[0];
    const doneIds = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id));
    const scoped = data.tasks.some(t => t.engine)
      ? data.tasks.filter(t => !t.engine || t.engine === engine)
      : data.tasks;
    const ready = scoped.filter(t => {
      if (t.status !== 'backlog') return false;
      const deps = t.blocked_by || [];
      return deps.every(d => doneIds.has(d));
    });
    if (ready.length === 0) {
      console.log('NONE');
    } else {
      ready.forEach(t => console.log(t.id));
    }
  "
}

# Display dependency graph
cmd_graph() {
  ensure_state
  STATE="$STATE_FILE" node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(process.env.STATE, 'utf8'));
    const statusIcon = { backlog: '○', in_progress: '◐', review: '◑', done: '●' };
    console.log('Dependency Graph:');
    console.log('');
    data.tasks.forEach(t => {
      const icon = statusIcon[t.status] || '?';
      const deps = (t.blocked_by || []).join(', ') || 'none';
      console.log(icon + ' ' + t.id + ' [' + t.status + '] ' + (t.title || '').substring(0, 30));
      console.log('    blocked_by: ' + deps);
    });
  "
}

# Route command
case "${1}" in
  init)        cmd_init "$2" ;;
  add-epic)    cmd_add_epic "$2" "$3" ;;
  add-task)    cmd_add_task "$2" "$3" "$4" "$5" ;;
  update)      cmd_update "$2" "$3" ;;
  next)        cmd_next ;;
  ready)       cmd_ready ;;
  graph)       cmd_graph ;;
  kanban)      cmd_kanban ;;
  phase-check) cmd_phase_check ;;
  epic-check)  cmd_epic_check "$2" ;;
  list)        cmd_list "$2" ;;
  *)
    echo "Weave Progress Manager"
    echo "Usage: progress.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  init <project>             Initialize progress.json"
    echo "  add-epic <id> <title>      Add an epic"
    echo "  add-task <id> <epic> <title>  Add a task"
    echo "  update <task-id> <status>  Update status (backlog|in_progress|review|done)"
    echo "  next                       Get next backlog task ID"
    echo "  ready                      Get tasks ready to start (deps satisfied)"
    echo "  kanban                     Display kanban board"
    echo "  phase-check                Check if phase is complete"
    echo "  epic-check <epic-id>       Check if an epic is complete (sets epic status=done)"
    echo "  list [status]              List tasks"
    echo "  graph                      Show dependency graph"
    ;;
esac

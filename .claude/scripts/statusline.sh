#!/usr/bin/env bash
# Weave statusLine command. Reads JSON from Claude Code on stdin; prints the
# status line above the prompt.
#
# Rich two-line output (when jq is available):
#   time  folder (branch)* +N -M  [mode]  phase
#   model:effort  ████░░░ NN%  $cost
# Falls back to a plain single line when jq is not installed.

set -u

input=$(cat 2>/dev/null || true)

# --- Field helpers ---
project_dir="${CLAUDE_PROJECT_DIR:-}"

# =====================================================================
# Fallback: no jq. Plain single line, no colours/cost/bar (those need jq).
# =====================================================================
if ! command -v jq >/dev/null 2>&1; then
  _s() {
    local key; key="${1##*.}"
    printf '%s' "$input" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
  }
  cwd=$(_s '.cwd'); [ -z "$cwd" ] && cwd="$PWD"
  [ -z "$project_dir" ] && project_dir="$cwd"
  model=$(_s '.model.display_name'); [ -z "$model" ] && model="claude"
  branch=""; dirty=""
  if branch=$(git --no-optional-locks -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null); then
    [ -n "$(git --no-optional-locks -C "$cwd" status --porcelain 2>/dev/null)" ] && dirty="*"
  fi
  phase=""
  progress_file="${project_dir}/.claude/state/progress.json"
  [ -f "$progress_file" ] && phase=$(sed -n 's/.*"phase"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$progress_file" | head -n1)
  out="$(basename "$cwd")"
  [ -n "$branch" ] && out="$out · ${branch}${dirty}"
  out="$out · $model"
  [ -n "$phase" ] && out="$out · $phase"
  printf '%s' "$out"
  exit 0
fi

# =====================================================================
# Rich path (jq present)
# =====================================================================

# --- Workspace ---
cwd=$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // empty')
[ -z "$cwd" ] && cwd="$(pwd)"
[ -z "$project_dir" ] && project_dir=$(printf '%s' "$input" | jq -r '.workspace.project_dir // empty')
[ -z "$project_dir" ] && project_dir="$cwd"
folder="${cwd/#$HOME/~}"

# --- ANSI colors ---
bold="\033[1m"; green="\033[32m"; cyan="\033[36m"; blue="\033[34m"
red="\033[31m"; yellow="\033[33m"; magenta="\033[35m"; dim="\033[2m"; reset="\033[0m"

# --- Time ---
time_part=$(date +%H:%M)

# --- Git branch + dirty + diff stats ---
branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short HEAD 2>/dev/null)
if [ -n "$branch" ]; then
  dirty=$(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null)
  if [ -n "$dirty" ]; then
    git_part=" ${blue}${bold}(${reset}${red}${branch}${blue}${bold})${reset}${yellow}*${reset}"
  else
    git_part=" ${blue}${bold}(${reset}${green}${branch}${blue}${bold})${reset}"
  fi
  diff_stat=$(git -C "$cwd" --no-optional-locks diff --shortstat HEAD 2>/dev/null)
  if [ -n "$diff_stat" ]; then
    added=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+')
    removed=$(echo "$diff_stat" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+')
    [ -z "$added" ]   && added=0
    [ -z "$removed" ] && removed=0
    git_part="${git_part} ${green}+${added}${reset} ${red}-${removed}${reset}"
  fi
else
  git_part=""
fi

# --- Model + effort ---
model_name=$(printf '%s' "$input" | jq -r '.model.display_name // empty')
effort=$(printf '%s' "$input" | jq -r '.effortLevel // empty')
# effortLevel lives in settings, not the JSON — fall back to project then home settings
if [ -z "$effort" ]; then
  effort=$(jq -r '.effortLevel // empty' "${project_dir}/.claude/settings.json" 2>/dev/null)
fi
if [ -z "$effort" ]; then
  effort=$(jq -r '.effortLevel // empty' "${HOME}/.claude/settings.json" 2>/dev/null)
fi
if [ -n "$model_name" ]; then
  model_part="${dim}${model_name}${reset}"
  [ -n "$effort" ] && model_part="${model_part}${dim}:${effort}${reset}"
else
  model_part=""
fi

# --- Context window ---
used_pct=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty')
if [ -z "$used_pct" ]; then
  total_in=$(printf '%s' "$input" | jq -r '.context_window.total_input_tokens // 0')
  if [ "$total_in" -gt 0 ] 2>/dev/null; then
    used_pct=$(echo "$total_in 200000" | awk '{printf "%.1f", ($1/$2)*100}')
  fi
fi
if [ -n "$used_pct" ]; then
  used_int=$(printf "%.0f" "$used_pct")
  if [ "$used_int" -ge 70 ]; then ctx_color="$red"
  elif [ "$used_int" -ge 50 ]; then ctx_color="$yellow"
  else ctx_color="$green"; fi
else
  ctx_color="$green"
fi

# --- Mode / permissions ---
mode_flags=""
skip_dangerous=$(printf '%s' "$input" | jq -r '.skipDangerousModePermissionPrompt // false')
[ "$skip_dangerous" = "true" ] && mode_flags="${mode_flags}${red}${bold}YOLO${reset} "
output_style=$(printf '%s' "$input" | jq -r '.output_style.name // empty')
if [ -n "$output_style" ] && [ "$output_style" != "default" ]; then
  mode_flags="${mode_flags}${magenta}[${output_style}]${reset} "
fi
mode_flags="${mode_flags% }"

# --- Weave spec phase ---
phase=""
progress_file="${project_dir}/.claude/state/progress.json"
[ -f "$progress_file" ] && phase=$(jq -r '.phase // empty' "$progress_file" 2>/dev/null)

# --- Session cost ---
raw_cost=$(printf '%s' "$input" | jq -r '.cost.total_cost_usd // empty')
cost_part=""
if [ -n "$raw_cost" ]; then
  cost_fmt=$(printf "%.2f" "$raw_cost" 2>/dev/null)
  if [ -n "$cost_fmt" ] && [ "$cost_fmt" != "0.00" ]; then
    cost_part="${dim}\$${cost_fmt}${reset}"
  fi
fi

# --- Context bar ---
bar_width=11
if [ -n "$used_pct" ]; then
  used_int=$(printf "%.0f" "$used_pct")
  filled=$(( used_int * bar_width / 100 ))
  [ "$filled" -gt "$bar_width" ] && filled=$bar_width
  empty=$(( bar_width - filled ))
  bar_filled=""; bar_empty=""; i=0
  while [ $i -lt $filled ]; do bar_filled="${bar_filled}█"; i=$(( i + 1 )); done
  i=0
  while [ $i -lt $empty ];  do bar_empty="${bar_empty}░";  i=$(( i + 1 )); done
  ctx_line="${ctx_color}${bar_filled}${dim}${bar_empty}${reset} ${ctx_color}${used_int}%${reset}"
else
  bar_empty=""; i=0
  while [ $i -lt $bar_width ]; do bar_empty="${bar_empty}░"; i=$(( i + 1 )); done
  ctx_line="${dim}${bar_empty}${reset} ${green}0%${reset}"
fi

# --- Assemble ---
# Line 1: time  folder (branch)* +N -M  [mode]  phase
line1="${dim}${time_part}${reset}  ${cyan}${bold}${folder}${reset}${git_part}"
[ -n "$mode_flags" ] && line1="${line1}  ${mode_flags}"
[ -n "$phase" ] && line1="${line1}  ${magenta}${phase}${reset}"

# Line 2: model:effort  context bar + percentage  cost
if [ -n "$model_part" ]; then
  line2="${model_part}  ${ctx_line}"
else
  line2="${ctx_line}"
fi
[ -n "$cost_part" ] && line2="${line2}  ${cost_part}"

printf '%b\n' "$line1"
printf '%b\n' "$line2"

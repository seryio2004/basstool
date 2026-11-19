#!/usr/bin/env bash
# Delega una tarea a Sol 6.1 (Codex CLI) como subagente de Claude.
#
#   scripts/sol.sh <tarea> <encargo.md>
#
# Prepara la rama codex/<tarea> en el worktree de Codex, ejecuta `codex exec`
# sin interacción (sandbox workspace-write) y guarda el resumen final en
# .git/coord/sol/<tarea>.md y el registro en .git/coord/sol/<tarea>.log.
# Sol no integra en main: Claude revisa la rama e integra. Ver docs/COORDINACION.md.
set -euo pipefail

task="${1:-}"
brief="${2:-}"
if [[ ! "$task" =~ ^[a-z0-9][a-z0-9-]*$ || ! -f "$brief" ]]; then
  echo "Uso: scripts/sol.sh <tarea> <encargo.md>   (tarea en minúsculas, p. ej. tarea-5)" >&2
  exit 2
fi

gitdir="$(git rev-parse --path-format=absolute --git-common-dir)"
repo="$(dirname "$gitdir")"
wt="${SOL_WORKTREE:-$repo-codex}"
model="${SOL_MODEL:-gpt-6.1-sol}"
out="$gitdir/coord/sol"
branch="codex/$task"
mkdir -p "$out"

if [[ -n "$(git -C "$wt" status --porcelain)" ]]; then
  echo "El worktree de Codex ($wt) tiene cambios sin commit. Resuélvelo antes de delegar." >&2
  exit 1
fi
if git -C "$wt" rev-parse --verify -q "refs/heads/$branch" >/dev/null; then
  git -C "$wt" switch -q "$branch"
else
  git -C "$wt" switch -q -c "$branch" main
fi

prompt="Eres codex (Sol 6.1) y trabajas como subagente de Claude, que coordina el proyecto.
Lee AGENTS.md y docs/COORDINACION.md antes de empezar. Trabajas en $wt, rama $branch.

Encargo:
$(cat "$brief")

Al terminar:
1. Commits pequeños en tu rama con las comprobaciones pasando (npm run typecheck, npm test, npm run build).
2. NO integres en main: Claude revisa e integra.
3. Libera tus reservas (npm run coord -- release codex $task) y avisa: npm run coord -- send codex claude \"$task lista en $branch: …\".
4. Tu último mensaje debe ser un resumen breve: qué has hecho, archivos tocados, comprobaciones y su resultado, y qué queda pendiente o necesita decisión."

echo "Sol 6.1 trabajando en $branch… (registro: $out/$task.log)"
codex exec -C "$wt" --full-auto --add-dir "$gitdir" -m "$model" \
  -o "$out/$task.md" "$prompt" >"$out/$task.log" 2>&1
echo "Terminado. Resumen: $out/$task.md"

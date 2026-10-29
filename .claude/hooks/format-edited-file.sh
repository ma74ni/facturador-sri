#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): formatea con Prettier el archivo que Claude acaba de tocar.
# Solo ese archivo: el repo no está formateado en bloque y así los diffs siguen siendo revisables.
# Nunca bloquea la edición: cualquier fallo sale con 0.

file=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$file" in
  "$root"/packages/*.ts|"$root"/packages/*.tsx|"$root"/packages/*.js|"$root"/packages/*.jsx|"$root"/packages/*.json|"$root"/packages/*.css) ;;
  *) exit 0 ;;
esac

prettier="$root/node_modules/.bin/prettier"
[ -x "$prettier" ] && [ -f "$file" ] && "$prettier" --write --ignore-unknown --log-level warn "$file" >&2
exit 0

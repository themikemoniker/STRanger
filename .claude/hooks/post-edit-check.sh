#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: runs scoped typecheck on the changed file after Write/Edit.
# Reads file_path from stdin JSON. Blocks completion if typecheck fails.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# No file path — nothing to check
[ -z "$FILE_PATH" ] && exit 0
[ -f "$FILE_PATH" ] || exit 0

# Only check TypeScript files
case "$FILE_PATH" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip generated/vendored code
case "$FILE_PATH" in
  */node_modules/*|*/dist/*|*/.next/*|*/generated/*) exit 0 ;;
esac

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Determine which package was changed and run scoped typecheck
case "$FILE_PATH" in
  */packages/db/*)
    pnpm --filter @ranger/db typecheck 2>&1 || { echo "BLOCKED: @ranger/db typecheck failed"; exit 1; }
    ;;
  */packages/web/*)
    pnpm --filter @ranger/web typecheck 2>&1 || { echo "BLOCKED: @ranger/web typecheck failed"; exit 1; }
    ;;
  */packages/cli/*)
    pnpm --filter @ranger/cli typecheck 2>&1 || { echo "BLOCKED: @ranger/cli typecheck failed"; exit 1; }
    ;;
  */packages/agent/*)
    pnpm --filter @ranger/agent typecheck 2>&1 || { echo "BLOCKED: @ranger/agent typecheck failed"; exit 1; }
    ;;
  *)
    # File outside packages — run full typecheck
    pnpm typecheck 2>&1 || { echo "BLOCKED: typecheck failed"; exit 1; }
    ;;
esac

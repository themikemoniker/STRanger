#!/usr/bin/env bash
set -euo pipefail

# PostToolUse hook: runs typecheck and lint after Write/Edit tool calls.
# Blocks completion if either fails.

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "Running typecheck..."
pnpm typecheck || { echo "BLOCKED: typecheck failed"; exit 1; }

echo "Running lint..."
pnpm lint || { echo "BLOCKED: lint failed"; exit 1; }

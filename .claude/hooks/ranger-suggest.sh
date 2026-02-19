#!/usr/bin/env bash
# Stop hook: checks for active review on current branch.
# Outputs JSON with systemMessage if review exists.
# Always exits 0 — never blocks Claude Code.

INPUT=$(cat)
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "$INPUT" | node packages/cli/dist/index.js hook suggest 2>/dev/null || true
exit 0

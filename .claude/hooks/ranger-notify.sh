#!/usr/bin/env bash
# Async PostToolUse hook: pipes stdin to `ranger hook notify`.
# Always exits 0 — never blocks Claude Code.

INPUT=$(cat)
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
echo "$INPUT" | node packages/cli/dist/index.js hook notify 2>/dev/null || true
exit 0

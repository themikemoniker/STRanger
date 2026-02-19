# Ranger Roadmap

## Phase 1 — End-to-End Verification Flow (MVP)

**Goal:** Prove the full pipeline works: create review → trigger verification → view results with screenshots.

### Deliverables

- **Shared types** — IPC messages, API inputs, status enums, inferred row types
- **Drizzle relations** — Enable relational queries for dashboard
- **Seed script** — Sample profiles, reviews, scenarios, runs, artifacts
- **Web infrastructure** — DB singleton, ID generator, API helpers
- **API routes** — Profiles CRUD, Reviews CRUD, Scenarios CRUD, Runs list/detail, Artifacts file serving, Verify trigger/poll
- **Agent worker** — Playwright screenshot-only (navigate, scroll, capture screenshots, send verdict via IPC)
- **Agent manager** — Fork workers, handle IPC messages, write to DB
- **CLI commands** — setup, profile add/list, create, list, show, go (with polling)
- **Dashboard pages** — Reviews list, review detail (scenarios + latest runs), run detail (screenshot gallery)

### Constraints

- No LLM integration — agent captures screenshots only
- No SSE streaming — CLI polls for status
- All dashboard pages are server components (no "use client")
- Workers communicate via IPC, never touch DB directly

## Phase 2 — LLM-Powered Verification

**Goal:** Add AI-powered scenario execution with real browser interaction.

### Planned Deliverables

- **LLM integration** — Connect to Claude/OpenAI for ReAct loop (observe → think → act)
- **Browser interaction** — Click, type, scroll, navigate based on LLM decisions
- **SSE streaming** — Live step-by-step progress in CLI and dashboard
- **Auth flows** — Profile login with cookie persistence
- **Hook integration** — Claude Code hooks for auto-verification on edits
- **CI mode** — JSON output, exit codes, GitHub Actions integration
- **Comments system** — Pin feedback to screenshots with coordinates
- **Cleanup command** — Purge old artifacts and soft-deleted reviews

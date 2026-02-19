# STRanger Roadmap

## Phase 1 — End-to-End Verification Flow (MVP) [COMPLETE]

**Goal:** Prove the full pipeline works: create review → trigger verification → view results with screenshots.

**Status:** Complete and integration tested (2026-02-18).

### Deliverables

- [x] **Shared types** — IPC messages, API inputs, status enums, inferred row types
- [x] **Drizzle relations** — Enable relational queries for dashboard
- [x] **Seed script** — Sample profiles, reviews, scenarios, runs, artifacts
- [x] **Web infrastructure** — DB singleton, ID generator, API helpers
- [x] **API routes** — Profiles CRUD, Reviews CRUD, Scenarios CRUD, Runs list/detail, Artifacts file serving, Verify trigger/poll
- [x] **Agent worker** — Playwright screenshot-only (navigate, scroll, capture 5 screenshots, send verdict via IPC)
- [x] **Agent manager** — Fork workers, handle IPC messages, write to DB
- [x] **CLI commands** — setup, profile add/list, create, list, show, go (with polling)
- [x] **Dashboard pages** — Reviews list, review detail (scenarios + latest runs), run detail (screenshot gallery)

### Integration Test Results

- 27/27 API and dashboard tests passing
- Full E2E verify flow: create profile + review → trigger verify → Playwright captures 5 screenshots → verdict "passed" in ~2.5s → artifacts served via dashboard
- All 4 packages typecheck and build cleanly

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

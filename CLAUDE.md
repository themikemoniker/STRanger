# Ranger

## WHAT

Ranger is a self-hosted UI feature review automation tool. It uses a Playwright-powered browser agent to verify UI features against human-written scenarios.

### Monorepo structure (pnpm workspace)

```
packages/db      — Drizzle ORM + better-sqlite3 schema, client factory, migrations
packages/web     — Next.js 15 App Router dashboard + API server (port 4800)
packages/cli     — Commander.js CLI ("ranger" binary)
packages/agent   — Browser agent worker process (spawned via child_process.fork)
skills/          — Markdown context files for Claude Code
plugin/          — Claude Code plugin manifest
```

### Package dependency graph

```
packages/db        ← foundation: schema + client factory
  ↑         ↑
packages/web    packages/agent   ← agent imports db types only (IPC, no direct DB)
  ↑                  ↑
packages/cli         ← pure HTTP client to web, no DB connection
  ↑
plugin/              ← invokes CLI commands
skills/              ← static markdown, no code dependencies
```

### Tech stack

- **Runtime**: Node.js 20+, pnpm 9+
- **Language**: TypeScript (strict mode everywhere)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)
- **Web**: Next.js 15 App Router, Tailwind CSS v4
- **CLI**: Commander.js
- **Browser automation**: Playwright
- **Migrations**: drizzle-kit (plain SQL files)

## WHY

Coding agents (like Claude Code) build features but can't visually verify them. Ranger offloads UI verification to a separate browser agent that navigates the app, takes screenshots, and reports verdicts. The feedback loop: build → verify → read feedback → fix → re-verify.

## HOW

### Key commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (tsc for db/cli/agent, next build for web)
pnpm dev              # Start Next.js dev server on port 4800
pnpm typecheck        # Type-check all packages
pnpm lint             # Lint all packages
```

### Running individual packages

```bash
pnpm --filter @ranger/web dev        # Next.js dev server
pnpm --filter @ranger/cli build      # Build CLI
pnpm --filter @ranger/db db:generate # Generate Drizzle migration
pnpm --filter @ranger/db db:migrate  # Run Drizzle migration
```

### Workspace conventions

- All packages use `@ranger/` npm scope
- Cross-package imports use `workspace:*` protocol
- `packages/db` is the shared dependency — schema changes affect all packages
- The web package transpiles `@ranger/db` via `transpilePackages` in next.config.ts
- See sub-package READMEs for package-specific context

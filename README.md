# Ranger

Self-hosted UI feature review automation tool. Offloads visual verification from coding agents to a dedicated browser agent powered by Playwright and LLMs.

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full design — data model, API routes, agent worker architecture, CLI, hook system, and auth model.

## Packages

| Package | Description |
|---------|-------------|
| `packages/db` | Drizzle ORM schema, SQLite client factory, migrations |
| `packages/web` | Next.js App Router dashboard + API server |
| `packages/cli` | Commander.js CLI (`ranger` command) |
| `packages/agent` | Browser agent worker process |
| `skills/` | Markdown skill files for Claude Code context |
| `plugin/` | Claude Code plugin manifest and hooks |

## Quick Start

```bash
pnpm install
pnpm build
pnpm dev        # Start the Next.js dev server on port 4800
```

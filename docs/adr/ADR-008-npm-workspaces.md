# ADR-008 — npm Workspaces for the Monorepo (Week 1 Scaffold)

> **Status:** Accepted — 21 November 2026
> **Context:** Blueprint §11.2 planned the monorepo without locking the package manager; CONTRIBUTING.md originally sketched pnpm commands.

## Decision

Use **npm workspaces** (npm ≥ 10, Node ≥ 20) with TypeScript project references (`tsc -b`) for the Ascrap monorepo.

## Rationale

- **Zero extra install.** Every Node developer already has npm; pnpm requires a separate install or corepack step before the first command can run. For a local-first tool whose promise is "running in under a minute", the package manager must not be a hurdle.
- **Workspaces + project references are sufficient** at this scale: four packages (`schema`, `core`, `cli`, `mcp`) with a simple dependency DAG (schema → core → cli/mcp).
- **One lockfile** (`package-lock.json`) at the root keeps installs reproducible.

## Consequences

- CONTRIBUTING.md development commands use npm (`npm install`, `npm run build`, `npm test`).
- If the package count or build graph grows substantially, this ADR can be revisited in favour of pnpm + Turborepo; the package layout does not depend on the choice.

# Contributing to Ascrap

Thank you for considering a contribution. Ascrap values a **small, finished, well-tested core** over a sprawling feature list — scope discipline is a feature of this project.

## Before you start

1. Read the [Blueprint](./docs/BLUEPRINT.md) — especially the product principles (§1.4), differentiation pillars (§6), and the explicit out-of-scope list (§24).
2. Read [ETHICS.md](./ETHICS.md). Contributions that cross its red lines will not be accepted, however well engineered.
3. For anything larger than a bug fix, open an issue first so the design can be discussed before code is written.

## Principles for contributions

- **One schema source.** New capabilities start as a Zod schema in the schema package; library, MCP, CLI, and REST surfaces are generated or derived from it — never hand-duplicated.
- **Never browser-first.** Fetching changes must preserve the tiered waterfall (Tier 0 → 5) and prove with tests which tier serves a fixture.
- **Token cost is reported.** Any change to extraction or pruning must report its effect on tokens/page using the eval harness.
- **Fixture tests, not live sites.** Tests run against saved HTML fixtures in `fixtures/` — CI never scrapes live websites (it's flaky, impolite, and irreproducible).
- **Polite by default stays default.** Changes may add opt-ins, but may not weaken the defaults in `ETHICS.md`.

## Recipes (especially Indonesian / SEA)

A recipe contribution must include:

- A saved HTML **fixture** and its expected output (golden test)
- Correct locale handling — e.g. IDR prices (`Rp 1.250.000` → `1250000`), Bahasa Indonesia dates, explicit currency (never silently converted)
- A note confirming the target is a **public page** that respects the site's `robots.txt`

Recipes requiring login, CAPTCHA handling, or paywall access will be declined.

## Development

The monorepo uses npm workspaces (see `docs/adr/ADR-008-npm-workspaces.md`). From the repository root:

```bash
npm install        # install all workspace dependencies
npm run build      # tsc -b across packages (schema → core → cli, mcp)
npm test           # build + vitest (unit + fixture/golden tests in @ascrap/core)
node packages/cli/dist/index.js scrape https://example.com   # try the CLI
```

## Pull requests

- Keep PRs focused; one concern per PR.
- Include tests for behaviour changes and update `CHANGELOG.md` under *Unreleased*.
- Update the blueprint or docs if your change alters a documented decision — and add an ADR in `docs/adr/` for architecture-level choices.
- By contributing, you agree your contribution is licensed under the project's Apache-2.0 license.

## Reporting bugs

Please include: the URL pattern (redact anything private), which fetch tier was used, the `meta` object from the result, and whether the page is in the eval corpus. Security issues — especially SSRF or browser-sandbox concerns — should be reported privately to the maintainer first.

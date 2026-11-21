# Changelog

All notable changes to Ascrap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Week 2 (fit mode & Indonesian locale utilities)

- `fit` mode: deterministic query-focused pruning of extracted Markdown — blocks scored by query-term hits (heading hits weigh 3×), title block and section headings always kept for context, token budget respected (`scrape(url, { fit: true, query, maxTokens })`, CLI `--fit --query`); result meta now reports `fitApplied`
- IDR parser (`parseIdr`, `findIdrAmounts`): correct Indonesian formatting — `Rp 1.250.000` → `1250000`, decimal commas, and magnitude words (`850 ribu`, `1,25 juta`, `2,5 miliar`)
- Bahasa Indonesia date parser (`parseIndonesianDate`): named months full and abbreviated (`21 November 2026`, `3 Agu 2026`) and day-first numeric dates, returned as ISO `YYYY-MM-DD`, with impossible dates rejected
- 16 new tests (fit, IDR, dates) — 26 passing in total

### Added — Week 1 scaffold (v1 implementation started)

- TypeScript monorepo (npm workspaces + project references): `@ascrap/schema`, `@ascrap/core`, `ascrap` (CLI), `@ascrap/mcp` (placeholder, Week 5) — see `docs/adr/ADR-008-npm-workspaces.md`
- `@ascrap/schema`: Zod schemas as the single source of truth — scrape options, result, token meta, provenance, structured error codes
- `@ascrap/core`: Tier 1 HTTP fetch with robots.txt check (polite by default), SSRF guard for private/loopback hosts, Tier 2 Readability extraction to clean Markdown, cl100k_base token counting with per-result reporting, structured `AscrapError` codes (`blocked`, `not_found`, `robots_disallowed`, `ssrf_blocked`, …)
- CLI: `ascrap scrape <url>` with `--max-tokens`, `--out`, `--json`, `--no-robots`
- Test suite: golden-fixture extraction tests, token counter tests, result-schema contract tests (10 tests)

### Planned — v1.0.0

- Tiered fetching, remaining tiers: Tier 0 (site APIs / JSON-LD / sitemap) and Tier 3 (Playwright fallback); TLS impersonation
- Structured extraction with Zod schemas (LLM rung, provider-agnostic, including local models via Ollama)
- MCP server with 5 tools: `scrape`, `extract`, `crawl`, `map`, `watch`
- CLI: `crawl`, `extract`, `eval` commands (`scrape` landed in the Week 1 scaffold)
- SQLite content cache with `maxAge` / ETag support
- 50-site evaluation harness with reproducible benchmark reporting
- Indonesian recipe pack (3 recipes) — the built-in IDR and Bahasa Indonesia date parsers landed in Week 2
- One-command Docker run with the complete core feature set

## [0.1.0] — 2026-11-21

### Added

- Project blueprint v1.0 (`docs/BLUEPRINT.md`): market and competitor research (November 2026), product definition, 7 differentiation pillars, system architecture and ADRs, API design, token-efficiency and evaluation design, Indonesian/SEA recipe pack specification, ethics and legal posture, security design, and a 6-week solo v1 roadmap
- Professional README with tagline, planned v1 API (library, MCP, CLI), use cases, and roadmap
- `ETHICS.md` — polite-by-default posture and contribution red lines
- `CONTRIBUTING.md` — contribution principles, recipe requirements, and testing rules
- Apache-2.0 `LICENSE`
- Node/TypeScript `.gitignore`

[Unreleased]: https://github.com/0xOzy/Ascrap/commits/main
[0.1.0]: https://github.com/0xOzy/Ascrap/releases/tag/v0.1.0

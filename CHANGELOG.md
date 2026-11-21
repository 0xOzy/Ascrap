# Changelog

All notable changes to Ascrap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Week 1 scaffold (v1 implementation started)

- TypeScript monorepo (npm workspaces + project references): `@ascrap/schema`, `@ascrap/core`, `ascrap` (CLI), `@ascrap/mcp` (placeholder, Week 5) — see `docs/adr/ADR-008-npm-workspaces.md`
- `@ascrap/schema`: Zod schemas as the single source of truth — scrape options, result, token meta, provenance, structured error codes
- `@ascrap/core`: Tier 1 HTTP fetch with robots.txt check (polite by default), SSRF guard for private/loopback hosts, Tier 2 Readability extraction to clean Markdown, cl100k_base token counting with per-result reporting, structured `AscrapError` codes (`blocked`, `not_found`, `robots_disallowed`, `ssrf_blocked`, …)
- CLI: `ascrap scrape <url>` with `--max-tokens`, `--out`, `--json`, `--no-robots`
- Test suite: golden-fixture extraction tests, token counter tests, result-schema contract tests (10 tests)

### Planned — v1.0.0

- Tiered fetching, remaining tiers: Tier 0 (site APIs / JSON-LD / sitemap) and Tier 3 (Playwright fallback); TLS impersonation
- `fit` (query-focused) output mode
- Structured extraction with Zod schemas (LLM rung, provider-agnostic, including local models via Ollama)
- MCP server with 5 tools: `scrape`, `extract`, `crawl`, `map`, `watch`
- CLI: `crawl`, `extract`, `eval` commands (`scrape` landed in the Week 1 scaffold)
- SQLite content cache with `maxAge` / ETag support
- 50-site evaluation harness with reproducible benchmark reporting
- Indonesian recipe pack (3 recipes) with built-in IDR and Bahasa Indonesia date parsers
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

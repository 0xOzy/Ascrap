# Changelog

All notable changes to Ascrap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned — v1.0.0

- Tiered fetching (Tier 0–3): site APIs / JSON-LD / sitemap, HTTP with TLS impersonation, Readability-class extraction, Playwright fallback
- Markdown and `fit` (query-focused) output with per-result token reporting
- Structured extraction with Zod schemas (LLM rung, provider-agnostic, including local models via Ollama)
- MCP server with 5 tools: `scrape`, `extract`, `crawl`, `map`, `watch`
- CLI: `scrape`, `crawl`, `extract`, `mcp`, `eval`
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

# Changelog

All notable changes to Ascrap will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — Week 4 (structured extraction & code-gen recipes)

- `extract(url, schema, { llm })`: structured extraction validated against the user's Zod schema, with one automatic repair retry on validation failure and structured `extraction_failed` / `llm_unavailable` errors
- LLM rung behind a one-method `LlmProvider` interface — `OllamaProvider` (local, key-free, the default), `OpenAiCompatibleProvider` (any OpenAI-compatible endpoint), `MockLlmProvider` (deterministic, for tests) — no vendor SDKs
- **Code-gen extractor cache**: the LLM also returns a CSS selector per field; selectors are sanitized against the real DOM and stored per origin + schema hash in SQLite. Repeat extractions run deterministically at zero LLM cost (`meta.method: "codegen"`) until a recipe stops validating, then the LLM re-teaches it
- Recipe application coerces values by field kind, reusing the Week 2 parsers: IDR amounts (`Rp 1.250.000` → `1250000`) and bilingual availability text ("Tersedia", "In stock", "Out of stock", "Stok Habis")
- CLI: `ascrap extract <url> --schema-json <file>` (JSON Schema in, no TypeScript needed) with `--provider ollama|openai`, `--model`, and `--extractor-cache`
- Zod utilities: schema description for prompts, field-kind inspection, JSON Schema → Zod conversion
- 8 new tests (LLM rung, repair retry, code-gen rung, coercion, schema utilities) — 50 passing in total

### Added — Week 3 (browser fallback, crawl, cache)

- Tier 0 (light): a full article body embedded in JSON-LD is preferred over DOM scraping (`extractorUsed: "json-ld"`, `meta.tier: 0`)
- Tier 3 browser fallback: conservative JS-gating detection (empty/thin extraction, SPA mount points, "needs JavaScript" notices) triggers headless Chromium rendering via Playwright — an optional dependency, imported lazily so the core stays light; without it, JS-gated pages fail with an actionable `needs_browser` error
- `crawl()`: breadth-first, same-origin crawl with `maxPages` / `maxDepth`, per-page failures collected as structured errors; CLI `ascrap crawl <url> --out <dir>` writes one Markdown file per page plus `crawl-summary.json`
- SQLite cache (`node:sqlite`, zero dependencies): `cachePath` + `maxAgeSeconds` options, fresh hits make no origin request and report `meta.cached`, stale entries revalidate with ETag / `If-None-Match`
- CLI `scrape` gains `--cache <file>` and `--no-browser`
- 16 new tests (JS-gating detection incl. link-dominated shells, proxy-from-env, cache, crawl helpers, JSON-LD) — 42 passing in total

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

- Tiered fetching, remaining work: Tier 0 site APIs / RSS / sitemap inputs and TLS impersonation (JSON-LD and the Tier 3 Playwright fallback landed in Week 3)
- MCP server with 5 tools: `scrape`, `extract`, `crawl`, `map`, `watch`
- CLI: `eval` command (`scrape` landed in Week 1, `crawl` in Week 3, `extract` in Week 4)
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

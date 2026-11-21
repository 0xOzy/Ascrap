<div align="center">

# Ascrap

### The web, ready for your agent.

**MCP-native, TypeScript-first web scraping framework for AI agents — clean, token-efficient Markdown and schema-valid JSON from any URL. Local-first. No API key required.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Status: v1 in progress](https://img.shields.io/badge/Status-v1%20In%20Progress-orange.svg)](./docs/BLUEPRINT.md)
[![MCP Native](https://img.shields.io/badge/MCP-Native-purple.svg)](#-mcp-server)
[![TypeScript First](https://img.shields.io/badge/TypeScript-First-3178C6.svg)](#-planned-usage-v1)

[Blueprint](./docs/BLUEPRINT.md) · [Ethics](./ETHICS.md) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

</div>

> **Language:** **English** | [Bahasa Indonesia](./README.id.md)

---

## Why Ascrap?

AI agents don't read the web like humans, and they don't scrape it like classic crawlers either. An agent discovers an **unknown URL mid-task** and needs, right now:

- **Clean content, not HTML** — Markdown or JSON that fits its context window
- **As few tokens as possible** — boilerplate is literally money burned
- **A tool it can call** — a small, well-described MCP / function-calling surface with strict schemas
- **Structured errors it can act on** — `blocked`, `needs_browser`, `robots_disallowed`, not a stack trace

Classic loaders return raw text full of navigation junk (in one measured study, ~52% of a page's characters were navigation). Hosted scraping APIs solve this, but meter it with credits that multiply silently for structured extraction — and their self-hosted versions are feature subsets. The best extraction frameworks today are Python-only, while the agent ecosystem is TypeScript-centric.

**Ascrap is built to close that gap.**

## What makes it different

| Pillar | What it means |
| --- | --- |
| **MCP-native, one schema source** | A single Zod schema generates the library API, the MCP tools, the function-calling definitions, and the REST API. No drift between surfaces. |
| **Token budget as a first-class API** | Ask for `maxTokens: 4000` focused on a query — and get back exactly what it cost: tokens used, tokens saved vs. raw HTML, tier and extractor used. |
| **Local-first, full-feature** | The complete core runs on your machine with one command. No API key, no telemetry, your URLs never leave your machine. Not a subset of a cloud product. |
| **Extract once, run free forever** | First visit uses an LLM + your Zod schema, then generates and caches a deterministic extractor. Repeat scrapes cost zero LLM tokens until confidence drops. |
| **Indonesian / SEA recipe pack** | Tested recipes for Indonesian public sites: correct IDR parsing (`Rp 1.250.000` → `1250000`), Bahasa Indonesia dates and boilerplate, ID locale profiles. |
| **Polite by default** | `robots.txt` respected by default, per-domain rate limits, honest bot identity, Content Signals and HTTP 402 aware — with a provenance record on every result. |
| **Honest about anti-bot** | Ascrap stops and reports `blocked` instead of silently escalating cost. No "Cloudflare bypass" promises — see [ETHICS.md](./ETHICS.md). |

## How it will work

Ascrap fetches in tiers — **never browser-first**:

```text
Tier 0  The site's own API / JSON-LD / RSS / sitemap / llms.txt   (cheapest, most stable)
Tier 1  HTTP fetch + TLS impersonation                            ~40–300 ms
Tier 2  Readability-class extraction on that HTML
Tier 3  Headless browser (Playwright) — only if Tier 1 is empty / JS-gated
Tier 4  Stealth browser (Patchright) — only if Tier 3 is challenged
Tier 5  STOP, report blocked — never escalate cost silently
```

Raw HTML for a typical article is ~17k tokens. A reader brings that to ~4.7–5.9k. Query-focused pruning can bring it to ~1.5k. Ascrap reports these numbers on **every** result, and ships a public 50-site evaluation harness so the claims are reproducible — not marketing.

## Planned usage (v1)

> **Status:** v1 implementation is **in progress — Weeks 1–2 have landed**: the monorepo, Zod schema package, Tier 1 fetching + Readability extraction, the `ascrap scrape` CLI, query-focused `fit` pruning, and the Indonesian IDR & date parsers all run today from this repository (`npm install && npm run build`). The remaining API surface is the v1 design target; npm publication arrives with v1.0.

### Library

```ts
import { scrape, extract } from "ascrap";
import { z } from "zod";

// One page -> clean, token-budgeted Markdown
const page = await scrape("https://example.co.id/artikel", {
  maxTokens: 4000,
  query: "harga dan ketersediaan",
  fit: true,
});

console.log(page.markdown);
console.log(page.meta); // { tokens, tokensSavedVsHtml, tier, extractorUsed, ms }
console.log(page.provenance); // { url, fetchedAt, robots: "allowed" }

// One page + one Zod schema -> validated JSON
const Product = z.object({
  name: z.string(),
  priceIdr: z.number(), // "Rp 1.250.000" -> 1250000, built-in IDR parser
  currency: z.literal("IDR"),
  inStock: z.boolean(),
});

const product = await extract("https://example.co.id/produk/123", { schema: Product });
```

### MCP server

Five small tools — `scrape`, `extract`, `crawl`, `map`, `watch` — designed to work in Claude Code, Cursor, and other MCP clients in under a minute, with **no API key** for the local core:

```json
{
  "mcpServers": {
    "ascrap": {
      "command": "npx",
      "args": ["-y", "ascrap", "mcp"]
    }
  }
}
```

### CLI

```bash
npx ascrap scrape https://example.co.id/artikel --max-tokens 4000 --query "harga"
npx ascrap crawl https://docs.example.co.id --max-pages 100 --out ./docs-md/
npx ascrap extract https://example.co.id/produk/123 --schema ./product.zod.ts
npx ascrap mcp    # run the MCP server (stdio)
npx ascrap eval   # reproduce the benchmark table on the 50-site corpus
```

## Use cases

1. **RAG ingestion** — crawl a docs / help site into heading-structured Markdown with citation & provenance metadata
2. **Research agents** — search → read → synthesise, without burning context on boilerplate
3. **Structured pipelines** — products, jobs, listings, and company data as schema-valid JSON, without hand-written selectors
4. **Change monitoring for agents** — `watch(url, schema)` returns only a semantic diff, not the whole page again
5. **Local & personal agents** — read the web from your own machine, privately, with local LLMs

## Project status & roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| **Blueprint** | Market & competitor research, architecture, API design, 6-week roadmap | ✅ Complete — see [`docs/BLUEPRINT.md`](./docs/BLUEPRINT.md) |
| **v1.0** | Tier 1–3 fetching, Markdown + fit mode with token reporting, Zod extraction, MCP server (5 tools), CLI, SQLite cache, 50-site eval harness, 3 Indonesian recipes, one-command Docker | 🚧 In progress — Weeks 1–2 landed (scaffold, fit mode, IDR & date parsers) |
| **v1.5** | Code-gen extraction cache, `watch` with semantic diffs, authenticated REST API, LangChain.js / LlamaIndex wrappers, more ID recipes | Planned |
| **v2.0** | Only if real usage appears: hosted demo, community recipes, thin Python SDK over MCP/REST | Exploratory |

Explicitly **out of scope**: proxy/IP provisioning, CAPTCHA solving, login or paywall scraping, and visual browser agents (clicking / form-filling) — Ascrap provides the data; it integrates with browser agents rather than competing with them.

## Documentation

- 📐 **[Full Blueprint](./docs/BLUEPRINT.en.md)** — research, competitor landscape, architecture, ADRs, eval design, legal & ethics posture, and the week-by-week v1 roadmap ([versi Bahasa Indonesia](./docs/BLUEPRINT.md))
- 🤝 **[ETHICS.md](./ETHICS.md)** — polite-by-default rules every recipe and contribution must follow
- 🛠 **[CONTRIBUTING.md](./CONTRIBUTING.md)** — how to contribute, including the recipe red lines
- 📋 **[CHANGELOG.md](./CHANGELOG.md)** — version history (SemVer from day one)

## Ringkasan Bahasa Indonesia

**Ascrap** adalah framework web scraping open-source yang dirancang khusus untuk AI agent: TypeScript-first, MCP-native, dan local-first (tanpa API key). Dari URL apa pun, Ascrap menghasilkan Markdown bersih yang hemat token atau JSON terstruktur yang valid terhadap skema Zod — lengkap dengan laporan jumlah token dan catatan provenance di setiap hasil. Fitur pembedanya meliputi ekstraksi *code-gen* (LLM hanya dipakai sekali, scraping berikutnya gratis), paket resep situs publik Indonesia (termasuk parser harga IDR dan tanggal Bahasa Indonesia), serta postur *polite-by-default* yang menghormati `robots.txt`. Blueprint lengkapnya tersedia di [`docs/BLUEPRINT.md`](./docs/BLUEPRINT.md).

## License

Licensed under the **Apache License 2.0** — see [LICENSE](./LICENSE).

Apache-2.0 was chosen deliberately: a patent grant and commercial-embedding friendliness that AGPL (used by some hosted competitors) does not offer a portfolio-scale project.

---

<div align="center">

Built by [@0xOzy](https://github.com/0xOzy) · Blueprint v1.0 — 21 November 2026

</div>

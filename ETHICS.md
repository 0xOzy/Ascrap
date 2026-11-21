# Ethics & Responsible Use

Ascrap is **polite by default** — not as a limitation, but as a feature. Builders of RAG pipelines and AI agents increasingly need scraping they can defend: to publishers, to clients, and in audit. This document is the posture every part of Ascrap — core, recipes, and examples — must follow.

## Defaults in the core

1. **Public pages only.** Ascrap targets publicly accessible pages. It does not scrape behind logins.
2. **`robots.txt` respected by default.** Compliance is ON; turning it off is an explicit, logged user choice.
3. **Honest identification.** Ascrap identifies itself with a truthful User-Agent and a contact, and honours `Crawl-delay`.
4. **Content Signals honoured.** `search` / `ai-input` / `ai-train` signals in `robots.txt` are read and recorded in each result's provenance.
5. **HTTP 402 means stop.** If a publisher uses Pay Per Crawl (HTTP 402), Ascrap stops and reports it — it does not evade payment mechanisms.
6. **Per-domain rate limiting by default**, with aggressive caching (`maxAge` / ETag) so repeat crawls don't re-hit origins.
7. **Provenance on every result** — source URL, fetch time, robots decision, and licence signals travel with the data, for citation and audit.

## Red lines — never built, never accepted as contributions

- CAPTCHA solving as a feature
- Paywall circumvention
- Login scraping or session/credential harvesting
- Recipes that target personal data (profiles, reviews with personal identifiers, contact details) — see Indonesia's PDP Law (UU No. 27/2022) and the GDPR, both of which govern *public* personal data too
- Marketing or documentation that promises to "scrape any site" or "bypass Cloudflare"

## On anti-bot honesty

No open-source tool reliably beats Cloudflare / DataDome at scale without residential proxies, and no open-source tool ships proxy IPs. Ascrap renders JavaScript like a browser, escalates through its fetch tiers transparently, and when it is challenged it **stops and reports `blocked`**. That honesty is deliberate: circumventing bot defences is also the new legal front (DMCA §1201 litigation in 2026), and promising bypass creates expectations no solo open-source project can honour.

## Legal note

This document describes Ascrap's design posture. It is **not legal advice**. Scraping public, logged-out pages has been treated favourably under the US CFAA (*Van Buren*; *hiQ v. LinkedIn*), but contract/Terms-of-Service claims, the EU DSM Directive Article 4 machine-readable opt-out, GDPR, and Indonesia's PDP Law can all apply depending on what you scrape, where, and how you use it. If in doubt, get permission or get counsel.

## Reporting

If you find an Ascrap recipe or example that violates this document, please open an issue — it will be treated as a bug.

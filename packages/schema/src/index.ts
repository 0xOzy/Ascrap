import { z } from "zod";

/**
 * @ascrap/schema — the single source of truth for Ascrap's data shapes.
 *
 * One Zod definition generates the library API types, the MCP tool schemas,
 * the function-calling definitions, and (from v1.5) the REST API.
 * Never hand-duplicate these shapes in another package.
 */

/** Structured error codes an agent can act on — never a raw stack trace. */
export const AscrapErrorCodeSchema = z.enum([
  "blocked",
  "needs_browser",
  "robots_disallowed",
  "not_found",
  "fetch_failed",
  "empty_content",
  "unsupported_content_type",
  "invalid_url",
  "ssrf_blocked",
  "extraction_failed",
  "llm_unavailable",
  "invalid_schema",
]);
export type AscrapErrorCode = z.infer<typeof AscrapErrorCodeSchema>;

/** Options accepted by `scrape()`. */
export const ScrapeOptionsSchema = z.object({
  /**
   * Hard token cap for the returned Markdown. Without `fit`, this truncates
   * at a paragraph boundary; with `fit`, it is the pruning budget.
   */
  maxTokens: z.number().int().positive().optional(),
  /** Focus query for `fit` mode: blocks are scored against its terms. */
  query: z.string().min(1).optional(),
  /** Enable `fit` (query-focused) pruning. Requires `query` to take effect. */
  fit: z.boolean().default(false),
  /** Respect robots.txt (default: true — polite by default). */
  respectRobots: z.boolean().default(true),
  /** Per-request timeout in milliseconds. */
  timeoutMs: z.number().int().positive().default(15_000),
  /**
   * Fall back to a headless browser (Tier 3) when the HTTP result looks
   * JavaScript-gated (Week 3). Requires the optional Playwright browser.
   */
  browserFallback: z.boolean().default(true),
  /** Path to the SQLite cache file. When set, results are cached (Week 3). */
  cachePath: z.string().min(1).optional(),
  /** How long a cached result stays fresh, in seconds. */
  maxAgeSeconds: z.number().int().nonnegative().default(3_600),
  /** User-Agent identity sent to origins. Ascrap identifies itself honestly. */
  userAgent: z
    .string()
    .default("AscrapBot/0.1 (+https://github.com/0xOzy/Ascrap)"),
});
export type ScrapeOptions = z.input<typeof ScrapeOptionsSchema>;
export type ResolvedScrapeOptions = z.output<typeof ScrapeOptionsSchema>;

/** Cost & method report attached to every result. Tokens are cl100k_base. */
export const ScrapeMetaSchema = z.object({
  /** Tokens in the returned Markdown. */
  tokens: z.number().int().nonnegative(),
  /** Tokens in the raw HTML as fetched, before any extraction. */
  tokensRawHtml: z.number().int().nonnegative(),
  /** Tokens saved versus serving the raw HTML to an LLM. */
  tokensSavedVsHtml: z.number().int(),
  /** Fetch tier that served this result (1 = HTTP, see blueprint Tier 0–5). */
  tier: z.number().int().min(0).max(5),
  /** Extractor that produced the Markdown. */
  extractorUsed: z.enum(["json-ld", "readability", "fallback-body"]),
  /** Wall-clock time for the whole scrape, in milliseconds. */
  ms: z.number().nonnegative(),
  /** Whether this result came from cache (cache lands in Week 3). */
  cached: z.boolean(),
  /** Whether `maxTokens` truncated the Markdown. */
  truncated: z.boolean(),
  /** Whether query-focused `fit` pruning was applied to the Markdown. */
  fitApplied: z.boolean(),
});
export type ScrapeMeta = z.infer<typeof ScrapeMetaSchema>;

/** Provenance record that travels with every result, for citation & audit. */
export const ProvenanceSchema = z.object({
  /** URL as requested. */
  url: z.string().url(),
  /** Final URL after redirects. */
  finalUrl: z.string().url(),
  /** HTTP status of the final response. */
  status: z.number().int(),
  /** ISO 8601 fetch timestamp. */
  fetchedAt: z.string().datetime(),
  /** robots.txt decision for this URL. */
  robots: z.enum(["allowed", "disallowed", "unavailable", "skipped"]),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** The standard result object returned by `scrape()`. */
export const ScrapeResultSchema = z.object({
  url: z.string().url(),
  finalUrl: z.string().url(),
  status: z.number().int(),
  /** Page title as extracted, when available. */
  title: z.string().nullable(),
  /** Clean Markdown. */
  markdown: z.string(),
  meta: ScrapeMetaSchema,
  provenance: ProvenanceSchema,
});
export type ScrapeResult = z.infer<typeof ScrapeResultSchema>;

/** Options accepted by `crawl()`. */
export const CrawlOptionsSchema = ScrapeOptionsSchema.extend({
  /** Maximum number of pages to fetch. */
  maxPages: z.number().int().positive().default(50),
  /** Maximum link depth from the start URL. */
  maxDepth: z.number().int().nonnegative().default(2),
});
export type CrawlOptions = z.input<typeof CrawlOptionsSchema>;
export type ResolvedCrawlOptions = z.output<typeof CrawlOptionsSchema>;

/** A page that failed during a crawl — collected, never thrown. */
export const CrawlPageErrorSchema = z.object({
  url: z.string(),
  code: AscrapErrorCodeSchema,
  message: z.string(),
});
export type CrawlPageError = z.infer<typeof CrawlPageErrorSchema>;

/** The result of a `crawl()` run. */
export const CrawlResultSchema = z.object({
  startUrl: z.string().url(),
  pages: z.array(ScrapeResultSchema),
  errors: z.array(CrawlPageErrorSchema),
  /** Wall-clock time for the whole crawl, in milliseconds. */
  ms: z.number().nonnegative(),
});
export type CrawlResult = z.infer<typeof CrawlResultSchema>;

/** Report attached to every structured-extraction result. */
export const ExtractMetaSchema = z.object({
  /** How the data was produced: an LLM call, or a cached deterministic extractor. */
  method: z.enum(["llm", "codegen"]),
  /** LLM provider name when `method` is "llm"; otherwise null. */
  provider: z.string().nullable(),
  /** Whether a stored code-gen recipe existed for this origin + schema. */
  recipeCached: z.boolean(),
  /** Wall-clock time for the extraction step, in milliseconds. */
  ms: z.number().nonnegative(),
});
export type ExtractMeta = z.infer<typeof ExtractMetaSchema>;

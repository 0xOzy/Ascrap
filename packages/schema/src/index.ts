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
]);
export type AscrapErrorCode = z.infer<typeof AscrapErrorCodeSchema>;

/** Options accepted by `scrape()`. */
export const ScrapeOptionsSchema = z.object({
  /**
   * Hard token cap for the returned Markdown. In Week 1 this truncates at a
   * paragraph boundary; query-focused `fit` pruning lands in Week 2.
   */
  maxTokens: z.number().int().positive().optional(),
  /** Focus query for `fit` mode (Week 2). Accepted now for forward compatibility. */
  query: z.string().min(1).optional(),
  /** Enable `fit` (query-focused) pruning. Week 2. */
  fit: z.boolean().default(false),
  /** Respect robots.txt (default: true — polite by default). */
  respectRobots: z.boolean().default(true),
  /** Per-request timeout in milliseconds. */
  timeoutMs: z.number().int().positive().default(15_000),
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
  extractorUsed: z.enum(["readability", "fallback-body"]),
  /** Wall-clock time for the whole scrape, in milliseconds. */
  ms: z.number().nonnegative(),
  /** Whether this result came from cache (cache lands in Week 3). */
  cached: z.boolean(),
  /** Whether `maxTokens` truncated the Markdown. */
  truncated: z.boolean(),
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

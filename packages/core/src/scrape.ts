import {
  ScrapeOptionsSchema,
  type ScrapeOptions,
  type ScrapeResult,
} from "@ascrap/schema";
import { AscrapError } from "./errors.js";
import { extractFromHtml } from "./extract.js";
import { applyFit } from "./fit.js";
import { checkRobots } from "./robots.js";
import { countTokens } from "./tokens.js";

/** Default token budget when `fit` is on but no explicit cap was given. */
const DEFAULT_FIT_BUDGET = 4_000;

/** Literal private / loopback / link-local hosts are never fetched (SSRF guard). */
function assertPublicUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AscrapError(
      "invalid_url",
      `Only http(s) URLs are supported: ${url.toString()}`,
    );
  }
  const host = url.hostname.toLowerCase();
  const isPrivateIp =
    /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host === "0.0.0.0";
  if (host === "localhost" || host.endsWith(".local") || isPrivateIp) {
    throw new AscrapError(
      "ssrf_blocked",
      `Refusing to fetch a private or loopback host: ${host}`,
    );
  }
}

/** Truncate Markdown at a paragraph boundary so the token cap never cuts mid-sentence. */
function truncateToTokens(
  markdown: string,
  maxTokens: number,
): { text: string; truncated: boolean } {
  if (countTokens(markdown) <= maxTokens) return { text: markdown, truncated: false };
  const paragraphs = markdown.split(/\n\n+/);
  const kept: string[] = [];
  for (const p of paragraphs) {
    if (countTokens([...kept, p].join("\n\n")) > maxTokens) break;
    kept.push(p);
  }
  const text = kept.join("\n\n").trim();
  return { text: text || markdown.slice(0, maxTokens * 4), truncated: true };
}

/**
 * Scrape one URL into clean, token-reported Markdown.
 *
 * Implements Tier 1 (HTTP fetch) + Tier 2 (Readability extraction) of the
 * blueprint's tiered waterfall, plus Week 2's query-focused `fit` pruning.
 * The browser tiers land in Week 3; a page that needs JavaScript today
 * fails with `empty_content` or `blocked`, reported honestly rather than
 * escalated silently.
 */
export async function scrape(
  rawUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  const started = performance.now();
  const opts = ScrapeOptionsSchema.parse(options);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AscrapError("invalid_url", `Not a valid URL: ${rawUrl}`);
  }
  assertPublicUrl(url);

  // Polite by default: robots.txt is checked unless the user explicitly opts out.
  let robots: ScrapeResult["provenance"]["robots"] = "skipped";
  if (opts.respectRobots) {
    const decision = await checkRobots(url, opts.userAgent, opts.timeoutMs);
    robots = decision;
    if (decision === "disallowed") {
      throw new AscrapError(
        "robots_disallowed",
        `robots.txt disallows scraping ${url.toString()} for ${opts.userAgent}`,
      );
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": opts.userAgent,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (cause) {
    throw new AscrapError(
      "fetch_failed",
      `Fetch failed for ${url.toString()}: ${(cause as Error).message}`,
    );
  }

  if (res.status === 404 || res.status === 410) {
    throw new AscrapError("not_found", `HTTP ${res.status} for ${url.toString()}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AscrapError(
      "blocked",
      `HTTP ${res.status} for ${url.toString()} — the origin refused this client. Ascrap reports this instead of escalating silently (see ETHICS.md).`,
    );
  }
  if (!res.ok) {
    throw new AscrapError(
      "fetch_failed",
      `HTTP ${res.status} for ${url.toString()}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/.test(contentType)) {
    throw new AscrapError(
      "unsupported_content_type",
      `Expected HTML, got "${contentType}" for ${url.toString()}`,
    );
  }

  const html = await res.text();
  const tokensRawHtml = countTokens(html);

  const extraction = extractFromHtml(html, res.url || url.toString());
  if (!extraction.markdown) {
    throw new AscrapError(
      "empty_content",
      `No readable content extracted from ${url.toString()} — the page may need JavaScript rendering (browser tiers land in Week 3).`,
    );
  }

  let markdown = extraction.markdown;
  let truncated = false;
  let fitApplied = false;
  if (opts.fit && opts.query) {
    const fitted = applyFit(markdown, opts.query, opts.maxTokens ?? DEFAULT_FIT_BUDGET);
    markdown = fitted.markdown;
    fitApplied = true;
    truncated = fitted.pruned;
  } else if (opts.maxTokens !== undefined) {
    const capped = truncateToTokens(markdown, opts.maxTokens);
    markdown = capped.text;
    truncated = capped.truncated;
  }

  const tokens = countTokens(markdown);
  const finalUrl = res.url || url.toString();

  return {
    url: url.toString(),
    finalUrl,
    status: res.status,
    title: extraction.title,
    markdown,
    meta: {
      tokens,
      tokensRawHtml,
      tokensSavedVsHtml: tokensRawHtml - tokens,
      tier: 1,
      extractorUsed: extraction.extractorUsed,
      ms: Math.round(performance.now() - started),
      cached: false,
      truncated,
      fitApplied,
    },
    provenance: {
      url: url.toString(),
      finalUrl,
      status: res.status,
      fetchedAt: new Date().toISOString(),
      robots,
    },
  };
}

import {
  ScrapeOptionsSchema,
  type ResolvedScrapeOptions,
  type ScrapeOptions,
  type ScrapeResult,
} from "@ascrap/schema";
import { fetchWithBrowser, looksJsGated } from "./browser.js";
import { ScrapeCache, isFresh } from "./cache.js";
import { AscrapError } from "./errors.js";
import { extractFromHtml, extractLinks } from "./extract.js";
import { applyFit } from "./fit.js";
import { checkRobots } from "./robots.js";
import { countTokens } from "./tokens.js";

/** Default token budget when `fit` is on but no explicit cap was given. */
const DEFAULT_FIT_BUDGET = 4_000;

/** Literal private / loopback / link-local hosts are never fetched (SSRF guard). */
export function assertPublicUrl(url: URL): void {
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

export interface ScrapePage {
  result: ScrapeResult;
  /** Absolute links found in the fetched document (empty for cache hits). */
  links: string[];
  /** The document HTML the result was extracted from (empty for cache hits). */
  html: string;
}

/**
 * Scrape one URL into clean, token-reported Markdown.
 *
 * The tiered waterfall (blueprint §8): Tier 0 JSON-LD when a page embeds a
 * full article body, Tier 1 HTTP fetch, Tier 2 Readability extraction,
 * Tier 3 headless-browser rendering only when the result looks
 * JavaScript-gated. Results can be cached in SQLite with ETag
 * revalidation. Blocked pages are reported, never escalated silently.
 */
export async function scrapePage(
  rawUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapePage> {
  const started = performance.now();
  const opts: ResolvedScrapeOptions = ScrapeOptionsSchema.parse(options);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AscrapError("invalid_url", `Not a valid URL: ${rawUrl}`);
  }
  assertPublicUrl(url);
  const cacheKey = url.toString();

  const cache = opts.cachePath ? new ScrapeCache(opts.cachePath) : null;
  try {
    const cached = cache?.get(cacheKey) ?? null;
    if (cached && isFresh(cached, opts.maxAgeSeconds)) {
      // A fresh cache hit makes no origin request at all — the politest tier.
      return {
        result: {
          ...cached.result,
          meta: {
            ...cached.result.meta,
            cached: true,
            ms: Math.round(performance.now() - started),
          },
        },
        links: [],
        html: "",
      };
    }

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

    const headers: Record<string, string> = {
      "user-agent": opts.userAgent,
      accept: "text/html,application/xhtml+xml",
    };
    if (cached?.etag) headers["if-none-match"] = cached.etag;

    let res: Response;
    try {
      res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (cause) {
      throw new AscrapError(
        "fetch_failed",
        `Fetch failed for ${url.toString()}: ${(cause as Error).message}`,
      );
    }

    if (res.status === 304 && cached) {
      cache?.touch(cacheKey);
      return {
        result: {
          ...cached.result,
          meta: {
            ...cached.result.meta,
            cached: true,
            ms: Math.round(performance.now() - started),
          },
        },
        links: [],
        html: "",
      };
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

    let html = await res.text();
    let finalUrl = res.url || url.toString();
    let status = res.status;
    let tier = 1;
    let extraction = extractFromHtml(html, finalUrl);

    // Tier 3: render in a browser only when the static result looks JS-gated.
    if (opts.browserFallback && looksJsGated(html, extraction.markdown)) {
      try {
        const rendered = await fetchWithBrowser(
          finalUrl,
          opts.userAgent,
          Math.max(opts.timeoutMs, 30_000),
        );
        const renderedExtraction = extractFromHtml(rendered.html, rendered.finalUrl);
        if (renderedExtraction.markdown.trim().length > extraction.markdown.trim().length) {
          html = rendered.html;
          finalUrl = rendered.finalUrl;
          status = rendered.status;
          extraction = renderedExtraction;
          tier = 3;
        }
      } catch (err) {
        // If the static extraction is empty, the browser was the only hope.
        if (!extraction.markdown.trim()) throw err;
        // Otherwise keep the static result — a thin page beats a failure.
      }
    }

    if (!extraction.markdown.trim()) {
      throw new AscrapError(
        "empty_content",
        `No readable content extracted from ${url.toString()} — the page may need JavaScript rendering (enable the Tier 3 browser fallback and install Playwright).`,
      );
    }
    if (tier === 1 && extraction.extractorUsed === "json-ld") tier = 0;

    const tokensRawHtml = countTokens(html);
    const links = extractLinks(html, finalUrl);

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
    const result: ScrapeResult = {
      url: url.toString(),
      finalUrl,
      status,
      title: extraction.title,
      markdown,
      meta: {
        tokens,
        tokensRawHtml,
        tokensSavedVsHtml: tokensRawHtml - tokens,
        tier,
        extractorUsed: extraction.extractorUsed,
        ms: Math.round(performance.now() - started),
        cached: false,
        truncated,
        fitApplied,
      },
      provenance: {
        url: url.toString(),
        finalUrl,
        status,
        fetchedAt: new Date().toISOString(),
        robots,
      },
    };

    cache?.set(cacheKey, result, res.headers.get("etag"));
    return { result, links, html };
  } finally {
    cache?.close();
  }
}

/** Scrape one URL. For link discovery (crawl), use `scrapePage`. */
export async function scrape(
  rawUrl: string,
  options: ScrapeOptions = {},
): Promise<ScrapeResult> {
  return (await scrapePage(rawUrl, options)).result;
}

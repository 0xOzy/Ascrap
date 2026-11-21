import {
  CrawlOptionsSchema,
  type CrawlOptions,
  type CrawlPageError,
  type CrawlResult,
  type ScrapeResult,
} from "@ascrap/schema";
import { AscrapError } from "./errors.js";
import { assertPublicUrl, scrapePage } from "./scrape.js";

/** Normalize a URL for visited-tracking: no hash, no trailing-slash duplicates. */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

/**
 * Breadth-first crawl of one origin, built on `scrapePage`.
 *
 * Same-origin links only; per-page failures are collected as structured
 * errors instead of aborting the crawl; robots.txt is honored for every
 * page through the normal scrape path.
 */
export async function crawl(
  startUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const started = performance.now();
  const opts = CrawlOptionsSchema.parse(options);

  let start: URL;
  try {
    start = new URL(startUrl);
  } catch {
    throw new AscrapError("invalid_url", `Not a valid URL: ${startUrl}`);
  }
  assertPublicUrl(start);
  const origin = start.origin;

  const { maxPages, maxDepth, ...scrapeOptions } = opts;

  const pages: ScrapeResult[] = [];
  const errors: CrawlPageError[] = [];
  const visited = new Set<string>([normalizeUrl(start.toString())]);
  const queue: { url: string; depth: number }[] = [
    { url: start.toString(), depth: 0 },
  ];

  while (queue.length > 0 && pages.length + errors.length < maxPages) {
    const item = queue.shift();
    if (!item) break;
    try {
      const { result, links } = await scrapePage(item.url, scrapeOptions);
      pages.push(result);
      if (item.depth < maxDepth) {
        for (const link of links) {
          let parsed: URL;
          try {
            parsed = new URL(link);
          } catch {
            continue;
          }
          if (parsed.origin !== origin) continue;
          const key = normalizeUrl(link);
          if (visited.has(key)) continue;
          visited.add(key);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    } catch (err) {
      if (err instanceof AscrapError) {
        errors.push({ url: item.url, code: err.code, message: err.message });
      } else {
        errors.push({
          url: item.url,
          code: "fetch_failed",
          message: (err as Error).message,
        });
      }
    }
  }

  return {
    startUrl: start.toString(),
    pages,
    errors,
    ms: Math.round(performance.now() - started),
  };
}

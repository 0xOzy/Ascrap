import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export interface Extraction {
  title: string | null;
  markdown: string;
  extractorUsed: "json-ld" | "readability" | "fallback-body";
}

const ARTICLE_TYPES = new Set([
  "Article",
  "NewsArticle",
  "BlogPosting",
  "ReportageNewsArticle",
  "ScholarlyArticle",
]);

/** Flatten JSON-LD candidates: the object itself, array members, and @graph members. */
function jsonLdCandidates(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(jsonLdCandidates);
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const graph = Array.isArray(obj["@graph"])
      ? (obj["@graph"] as unknown[]).flatMap(jsonLdCandidates)
      : [];
    return [obj, ...graph];
  }
  return [];
}

/**
 * Tier 0: when a page embeds a full article body in JSON-LD, that is the
 * cheapest and most stable source of truth — cleaner than any DOM scraping.
 */
function extractJsonLd(document: Document): Extraction | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    for (const candidate of jsonLdCandidates(data)) {
      const type = candidate["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (!types.some((t) => typeof t === "string" && ARTICLE_TYPES.has(t))) continue;
      const body = candidate["articleBody"];
      if (typeof body !== "string" || body.trim().length < 300) continue;
      const headline = candidate["headline"];
      const markdown = body
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .join("\n\n");
      if (!markdown) continue;
      return {
        title: typeof headline === "string" ? headline : null,
        markdown,
        extractorUsed: "json-ld",
      };
    }
  }
  return null;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Scripts/styles are never content; Readability strips most already, and the
// fallback path must not leak them into an LLM's context either.
turndown.remove(["script", "style", "noscript", "iframe", "form"]);

/** Extract absolute http(s) link targets from an HTML document (hashes stripped, deduped). */
export function extractLinks(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const links = new Set<string>();
  for (const anchor of dom.window.document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      resolved.hash = "";
      links.add(resolved.toString());
    } catch {
      // Ignore malformed hrefs.
    }
  }
  return [...links];
}

/**
 * Extract clean Markdown from an HTML document.
 * Pure function (no network) so it can be golden-tested against fixtures.
 */
export function extractFromHtml(html: string, url: string): Extraction {
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;

  const jsonLd = extractJsonLd(document);
  if (jsonLd) return jsonLd;

  const article = new Readability(document).parse();
  if (article?.content) {
    const markdown = turndown
      .turndown(article.content)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (markdown) {
      return {
        title: article.title ?? document.title ?? null,
        markdown,
        extractorUsed: "readability",
      };
    }
  }

  // Fallback: convert the whole body. Noisier, but honest — the caller can
  // see `extractorUsed: "fallback-body"` in the result meta.
  const bodyHtml = document.body?.innerHTML ?? "";
  const markdown = turndown
    .turndown(bodyHtml)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    title: document.title || null,
    markdown,
    extractorUsed: "fallback-body",
  };
}

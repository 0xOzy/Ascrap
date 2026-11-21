import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export interface Extraction {
  title: string | null;
  markdown: string;
  extractorUsed: "readability" | "fallback-body";
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Scripts/styles are never content; Readability strips most already, and the
// fallback path must not leak them into an LLM's context either.
turndown.remove(["script", "style", "noscript", "iframe", "form"]);

/**
 * Extract clean Markdown from an HTML document.
 * Pure function (no network) so it can be golden-tested against fixtures.
 */
export function extractFromHtml(html: string, url: string): Extraction {
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;

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

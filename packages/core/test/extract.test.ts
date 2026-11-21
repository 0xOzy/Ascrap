import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractFromHtml } from "../src/extract.js";

const fixture = readFileSync(
  new URL("./fixtures/article.html", import.meta.url),
  "utf8",
);

describe("extractFromHtml (golden fixture)", () => {
  const result = extractFromHtml(fixture, "https://example.co.id/berita/kopi");

  it("uses the readability extractor on an article page", () => {
    expect(result.extractorUsed).toBe("readability");
  });

  it("extracts the article title", () => {
    expect(result.title).toContain("Harga Kopi Robusta Naik");
  });

  it("keeps the article body", () => {
    expect(result.markdown).toContain("Rp 1.250.000 per kuintal");
    expect(result.markdown).toContain("pasokan global belum pulih");
  });

  it("drops navigation and footer boilerplate", () => {
    expect(result.markdown).not.toContain("Langganan Sekarang Juga");
    expect(result.markdown).not.toContain("Hak Cipta Dilindungi");
    expect(result.markdown).not.toContain("promo menarik hari ini");
  });

  it("produces Markdown, not HTML", () => {
    expect(result.markdown).not.toContain("<article>");
    expect(result.markdown).not.toContain("<p>");
  });
});

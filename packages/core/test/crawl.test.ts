import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/crawl.js";
import { extractLinks } from "../src/extract.js";

describe("normalizeUrl", () => {
  it("strips hashes and trailing slashes", () => {
    expect(normalizeUrl("https://example.co.id/docs/#bagian")).toBe(
      "https://example.co.id/docs",
    );
    expect(normalizeUrl("https://example.co.id/")).toBe("https://example.co.id/");
  });
});

describe("extractLinks", () => {
  const html = `
    <html><body>
      <a href="/docs/mulai">Mulai</a>
      <a href="https://example.co.id/docs/lanjut#bab2">Lanjut</a>
      <a href="https://lain.co.id/eksternal">Eksternal</a>
      <a href="mailto:halo@example.co.id">Email</a>
      <a href="/docs/mulai">Duplikat</a>
    </body></html>`;

  it("resolves relative links, strips hashes, dedupes, skips non-http", () => {
    const links = extractLinks(html, "https://example.co.id/");
    expect(links).toContain("https://example.co.id/docs/mulai");
    expect(links).toContain("https://example.co.id/docs/lanjut");
    expect(links).toContain("https://lain.co.id/eksternal");
    expect(links.filter((l) => l.endsWith("/docs/mulai"))).toHaveLength(1);
    expect(links.some((l) => l.startsWith("mailto:"))).toBe(false);
  });
});

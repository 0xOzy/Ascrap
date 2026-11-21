import { describe, expect, it } from "vitest";
import { ScrapeResultSchema } from "@ascrap/schema";

describe("ScrapeResultSchema (contract)", () => {
  it("accepts a well-formed scrape result", () => {
    const parsed = ScrapeResultSchema.parse({
      url: "https://example.co.id/artikel",
      finalUrl: "https://example.co.id/artikel",
      status: 200,
      title: "Contoh",
      markdown: "# Contoh\n\nIsi artikel.",
      meta: {
        tokens: 12,
        tokensRawHtml: 900,
        tokensSavedVsHtml: 888,
        tier: 1,
        extractorUsed: "readability",
        ms: 120,
        cached: false,
        truncated: false,
        fitApplied: false,
      },
      provenance: {
        url: "https://example.co.id/artikel",
        finalUrl: "https://example.co.id/artikel",
        status: 200,
        fetchedAt: "2026-11-21T15:00:00.000Z",
        robots: "allowed",
      },
    });
    expect(parsed.meta.tokensSavedVsHtml).toBe(888);
  });

  it("rejects an unknown extractor name", () => {
    expect(() =>
      ScrapeResultSchema.parse({
        url: "https://example.co.id/artikel",
        finalUrl: "https://example.co.id/artikel",
        status: 200,
        title: null,
        markdown: "x",
        meta: {
          tokens: 1,
          tokensRawHtml: 2,
          tokensSavedVsHtml: 1,
          tier: 1,
          extractorUsed: "magic",
          ms: 1,
          cached: false,
          truncated: false,
          fitApplied: false,
        },
        provenance: {
          url: "https://example.co.id/artikel",
          finalUrl: "https://example.co.id/artikel",
          status: 200,
          fetchedAt: "2026-11-21T15:00:00.000Z",
          robots: "allowed",
        },
      }),
    ).toThrow();
  });
});

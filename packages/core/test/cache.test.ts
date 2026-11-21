import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ScrapeResult } from "@ascrap/schema";
import { ScrapeCache, isFresh } from "../src/cache.js";

const RESULT: ScrapeResult = {
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
};

describe("ScrapeCache", () => {
  let dir: string;
  let cache: ScrapeCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ascrap-cache-"));
    cache = new ScrapeCache(join(dir, "cache.db"));
  });

  afterEach(() => {
    cache.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null for a missing URL", () => {
    expect(cache.get("https://example.co.id/none")).toBeNull();
  });

  it("round-trips a result with its ETag", () => {
    cache.set(RESULT.url, RESULT, '"abc123"');
    const entry = cache.get(RESULT.url);
    expect(entry?.result.markdown).toBe(RESULT.markdown);
    expect(entry?.etag).toBe('"abc123"');
    expect(entry?.storedAt).toBeGreaterThan(0);
  });

  it("overwrites on a repeated set", () => {
    cache.set(RESULT.url, RESULT, null);
    cache.set(RESULT.url, { ...RESULT, title: "Baru" }, null);
    expect(cache.get(RESULT.url)?.result.title).toBe("Baru");
  });

  it("persists across instances (it is a real file)", () => {
    cache.set(RESULT.url, RESULT, null);
    const reopened = new ScrapeCache(join(dir, "cache.db"));
    expect(reopened.get(RESULT.url)?.result.title).toBe("Contoh");
    reopened.close();
  });
});

describe("isFresh", () => {
  it("honors the max-age window", () => {
    const now = Date.now();
    const entry = { result: RESULT, etag: null, storedAt: now - 10_000 };
    expect(isFresh(entry, 60)).toBe(true);
    expect(isFresh(entry, 5)).toBe(false);
  });
});

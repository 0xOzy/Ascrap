import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { ScrapeResult } from "@ascrap/schema";
import { MockLlmProvider } from "../src/llm.js";
import type { ScrapePage } from "../src/scrape.js";
import {
  RecipeStore,
  applyRecipe,
  extractFromPage,
  schemaHash,
} from "../src/structured.js";
import { describeZodSchema, jsonSchemaToZod } from "../src/zod-utils.js";

const PRODUCT_HTML = `<!doctype html><html><head><title>Produk</title></head><body>
  <div class="product">
    <h1 class="product-name">Kopi Robusta Lampung 1kg</h1>
    <span class="price">Rp 1.250.000</span>
    <span class="stock">Tersedia</span>
    <ul class="tags"><li>Robusta</li><li>Lampung</li></ul>
  </div>
</body></html>`;

const ProductSchema = z.object({
  name: z.string(),
  priceIdr: z.number(),
  inStock: z.boolean(),
  tags: z.array(z.string()).optional(),
});

const LLM_REPLY = JSON.stringify({
  data: {
    name: "Kopi Robusta Lampung 1kg",
    priceIdr: 1250000,
    inStock: true,
    tags: ["Robusta", "Lampung"],
  },
  selectors: {
    name: ".product-name",
    priceIdr: ".price",
    inStock: ".stock",
    tags: ".tags li",
  },
});

function fakePage(): ScrapePage {
  const result: ScrapeResult = {
    url: "https://example.co.id/produk/1",
    finalUrl: "https://example.co.id/produk/1",
    status: 200,
    title: "Produk",
    markdown:
      "# Kopi Robusta Lampung 1kg\n\nRp 1.250.000\n\nTersedia\n\nRobusta, Lampung",
    meta: {
      tokens: 20,
      tokensRawHtml: 200,
      tokensSavedVsHtml: 180,
      tier: 1,
      extractorUsed: "readability",
      ms: 10,
      cached: false,
      truncated: false,
      fitApplied: false,
    },
    provenance: {
      url: "https://example.co.id/produk/1",
      finalUrl: "https://example.co.id/produk/1",
      status: 200,
      fetchedAt: "2026-11-21T15:00:00.000Z",
      robots: "allowed",
    },
  };
  return { result, links: [], html: PRODUCT_HTML };
}

describe("structured extraction", () => {
  let dir: string;
  let cachePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ascrap-extract-"));
    cachePath = join(dir, "recipes.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("LLM rung: validates output and teaches a recipe", async () => {
    const llm = new MockLlmProvider([LLM_REPLY]);
    const result = await extractFromPage(fakePage(), ProductSchema, {
      llm,
      extractorCachePath: cachePath,
    });
    expect(result.meta.method).toBe("llm");
    expect(result.meta.provider).toBe("mock");
    expect(result.data.priceIdr).toBe(1_250_000);
    expect(llm.prompts[0]).toContain("priceIdr");

    const store = new RecipeStore(cachePath);
    const recipe = store.get(
      "https://example.co.id",
      schemaHash(ProductSchema),
    );
    store.close();
    expect(recipe?.priceIdr).toBe(".price");
  });

  it("code-gen rung: second run needs no LLM and coerces IDR + boolean text", async () => {
    const llm = new MockLlmProvider([LLM_REPLY]);
    await extractFromPage(fakePage(), ProductSchema, {
      llm,
      extractorCachePath: cachePath,
    });

    const second = await extractFromPage(fakePage(), ProductSchema, {
      extractorCachePath: cachePath,
    });
    expect(second.meta.method).toBe("codegen");
    expect(second.meta.provider).toBeNull();
    expect(second.data).toEqual({
      name: "Kopi Robusta Lampung 1kg",
      priceIdr: 1_250_000,
      inStock: true,
      tags: ["Robusta", "Lampung"],
    });
  });

  it("repairs an invalid LLM answer once", async () => {
    const bad = JSON.stringify({
      data: { name: "X", priceIdr: "mahal", inStock: true },
      selectors: {},
    });
    const llm = new MockLlmProvider([bad, LLM_REPLY]);
    const result = await extractFromPage(fakePage(), ProductSchema, { llm });
    expect(result.data.priceIdr).toBe(1_250_000);
    expect(llm.prompts).toHaveLength(2);
    expect(llm.prompts[1]).toContain("failed schema validation");
  });

  it("fails honestly without an LLM and without a recipe", async () => {
    await expect(
      extractFromPage(fakePage(), ProductSchema, {}),
    ).rejects.toMatchObject({ code: "llm_unavailable" });
  });
});

describe("applyRecipe", () => {
  it("coerces availability text in both languages, negatives first", () => {
    const en = applyRecipe(
      `<span class="stock">In stock (22 available)</span>`,
      "https://example.co.id/",
      ProductSchema,
      { inStock: ".stock" },
    );
    expect(en.inStock).toBe(true);
    const out = applyRecipe(
      `<span class="stock">Out of stock</span>`,
      "https://example.co.id/",
      ProductSchema,
      { inStock: ".stock" },
    );
    expect(out.inStock).toBe(false);
    const habis = applyRecipe(
      `<span class="stock">Stok Habis</span>`,
      "https://example.co.id/",
      ProductSchema,
      { inStock: ".stock" },
    );
    expect(habis.inStock).toBe(false);
  });

  it("extracts and coerces values by field kind", () => {
    const candidate = applyRecipe(PRODUCT_HTML, "https://example.co.id/", ProductSchema, {
      name: ".product-name",
      priceIdr: ".price",
      inStock: ".stock",
      tags: ".tags li",
    });
    expect(candidate).toEqual({
      name: "Kopi Robusta Lampung 1kg",
      priceIdr: 1_250_000,
      inStock: true,
      tags: ["Robusta", "Lampung"],
    });
  });
});

describe("zod utilities", () => {
  it("describes an object schema with required and optional fields", () => {
    const described = describeZodSchema(ProductSchema) as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(described.properties.priceIdr).toEqual({ type: "number" });
    expect(described.required).toContain("name");
    expect(described.required).not.toContain("tags");
  });

  it("builds a working Zod schema from JSON Schema (CLI path)", () => {
    const built = jsonSchemaToZod({
      type: "object",
      properties: {
        name: { type: "string" },
        priceIdr: { type: "number" },
        inStock: { type: "boolean" },
      },
      required: ["name", "priceIdr"],
    });
    expect(built.parse({ name: "Kopi", priceIdr: 1000 })).toEqual({
      name: "Kopi",
      priceIdr: 1000,
    });
    expect(() => built.parse({ name: "Kopi", priceIdr: "1000" })).toThrow();
  });
});

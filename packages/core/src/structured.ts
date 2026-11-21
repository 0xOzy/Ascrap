import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import type { z, ZodObject, ZodRawShape } from "zod";
import type {
  ExtractMeta,
  ScrapeOptions,
  ScrapeResult,
} from "@ascrap/schema";
import { AscrapError } from "./errors.js";
import { parseIdr } from "./idr.js";
import type { LlmProvider } from "./llm.js";
import { scrapePage, type ScrapePage } from "./scrape.js";
import {
  describeZodSchema,
  fieldKinds,
  type FieldKind,
} from "./zod-utils.js";

/** A field → CSS selector mapping: the deterministic extractor for one page family. */
export type SelectorRecipe = Record<string, string>;

/** SQLite store of code-gen recipes, keyed by origin + schema hash. */
export class RecipeStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS extract_recipes (
         origin TEXT NOT NULL,
         schema_hash TEXT NOT NULL,
         selectors TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         PRIMARY KEY (origin, schema_hash)
       )`,
    );
  }

  get(origin: string, schemaHash: string): SelectorRecipe | null {
    const row = this.db
      .prepare(
        "SELECT selectors FROM extract_recipes WHERE origin = ? AND schema_hash = ?",
      )
      .get(origin, schemaHash) as { selectors: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.selectors) as SelectorRecipe;
    } catch {
      return null;
    }
  }

  set(origin: string, schemaHash: string, selectors: SelectorRecipe): void {
    this.db
      .prepare(
        `INSERT INTO extract_recipes (origin, schema_hash, selectors, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(origin, schema_hash) DO UPDATE SET
           selectors = excluded.selectors, created_at = excluded.created_at`,
      )
      .run(origin, schemaHash, JSON.stringify(selectors), Date.now());
  }

  close(): void {
    this.db.close();
  }
}

export function schemaHash(schema: ZodObject<ZodRawShape>): string {
  return createHash("sha256")
    .update(JSON.stringify(describeZodSchema(schema)))
    .digest("hex")
    .slice(0, 16);
}

function coerceScalar(text: string, kind: FieldKind): unknown {
  const value = text.trim();
  switch (kind) {
    case "number": {
      const idr = parseIdr(value);
      if (idr !== null) return idr;
      const numeric = Number(value.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(numeric) ? numeric : undefined;
    }
    case "boolean": {
      if (/^(true|ya|yes|1)$/i.test(value)) return true;
      if (/^(false|tidak|no|0)$/i.test(value)) return false;
      // Availability-style text: negatives win over positives
      // ("Out of stock" contains "stock" but means the opposite).
      if (/out of stock|habis|kosong|tidak tersedia|sold out|unavailable/i.test(value)) {
        return false;
      }
      if (/in stock|tersedia|ada stok|available|aktif/i.test(value)) return true;
      return false;
    }
    default:
      return value;
  }
}

/**
 * Apply a selector recipe to HTML deterministically — no LLM involved.
 * Returns a candidate object (unvalidated); the caller validates with Zod.
 */
export function applyRecipe(
  html: string,
  url: string,
  schema: ZodObject<ZodRawShape>,
  recipe: SelectorRecipe,
): Record<string, unknown> {
  const dom = new JSDOM(html, { url });
  const { document } = dom.window;
  const kinds = fieldKinds(schema);
  const out: Record<string, unknown> = {};

  for (const [field, selector] of Object.entries(recipe)) {
    const kind = kinds[field];
    if (!kind) continue;
    let elements: Element[];
    try {
      elements = [...document.querySelectorAll(selector)];
    } catch {
      continue;
    }
    if (elements.length === 0) continue;
    if (kind === "array") {
      out[field] = elements
        .map((el) => (el.textContent ?? "").trim())
        .filter(Boolean);
    } else {
      const text = (elements[0].textContent ?? "").trim();
      if (text) out[field] = coerceScalar(text, kind);
    }
  }
  return out;
}

/** Keep only selectors that are syntactically valid and match something. */
function sanitizeRecipe(
  raw: unknown,
  html: string,
  url: string,
): SelectorRecipe {
  if (!raw || typeof raw !== "object") return {};
  const dom = new JSDOM(html, { url });
  const recipe: SelectorRecipe = {};
  for (const [field, selector] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof selector !== "string" || !selector) continue;
    try {
      if (dom.window.document.querySelector(selector)) {
        recipe[field] = selector;
      }
    } catch {
      // Invalid selector — drop it.
    }
  }
  return recipe;
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object") {
    throw new AscrapError("extraction_failed", "LLM did not return a JSON object");
  }
  return parsed as Record<string, unknown>;
}

const MAX_PROMPT_MARKDOWN_CHARS = 24_000;

function buildPrompt(
  markdown: string,
  schema: ZodObject<ZodRawShape>,
): string {
  const schemaJson = JSON.stringify(describeZodSchema(schema), null, 2);
  return [
    "You extract structured data from a web page's Markdown.",
    "",
    "Return ONLY a JSON object with two keys:",
    '- "data": an object matching the schema below, exactly. Use null or omit fields you cannot find. Numbers must be plain numbers (no currency symbols or thousand separators).',
    '- "selectors": an object mapping each top-level schema field to ONE CSS selector that locates the element containing that field\'s value in the page HTML. Prefer stable class or data-attribute selectors.',
    "",
    "Schema:",
    schemaJson,
    "",
    "Page Markdown:",
    markdown.slice(0, MAX_PROMPT_MARKDOWN_CHARS),
  ].join("\n");
}

export interface ExtractOptions extends ScrapeOptions {
  /** LLM provider for the first (teaching) run. Required when no valid recipe exists. */
  llm?: LlmProvider;
  /** SQLite file for the code-gen recipe cache. Omit to disable recipes. */
  extractorCachePath?: string;
}

export interface ExtractResult<T> {
  data: T;
  meta: ExtractMeta;
  /** The underlying scrape result (Markdown, token meta, provenance). */
  scrape: ScrapeResult;
}

/**
 * Extract structured data from an already-scraped page.
 * Split from `extract()` so the pipeline is testable without network.
 */
export async function extractFromPage<T extends ZodRawShape>(
  page: ScrapePage,
  schema: ZodObject<T>,
  options: ExtractOptions = {},
): Promise<ExtractResult<z.infer<ZodObject<T>>>> {
  const started = performance.now();
  const url = page.result.finalUrl;
  const origin = new URL(url).origin;
  const hash = schemaHash(schema);

  const store = options.extractorCachePath
    ? new RecipeStore(options.extractorCachePath)
    : null;
  try {
    const recipe = store?.get(origin, hash) ?? null;

    // Code-gen path: a stored recipe runs deterministically, at zero LLM cost.
    if (recipe && page.html) {
      const candidate = applyRecipe(page.html, url, schema, recipe);
      const validated = schema.safeParse(candidate);
      if (validated.success) {
        return {
          data: validated.data,
          meta: {
            method: "codegen",
            provider: null,
            recipeCached: true,
            ms: Math.round(performance.now() - started),
          },
          scrape: page.result,
        };
      }
      // Recipe went stale (site changed) — fall through and re-teach.
    }

    // LLM rung: the model reads the Markdown once and teaches a recipe.
    const llm = options.llm;
    if (!llm) {
      throw new AscrapError(
        "llm_unavailable",
        recipe
          ? "The stored extractor recipe no longer validates and no LLM provider was given to refresh it."
          : "No extractor recipe exists for this origin + schema and no LLM provider was given. Pass an LlmProvider (e.g. OllamaProvider) for the first run.",
      );
    }

    const prompt = buildPrompt(page.result.markdown, schema);
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const fullPrompt =
        attempt === 0
          ? prompt
          : `${prompt}\n\nYour previous answer failed schema validation: ${lastError}\nReturn corrected JSON only.`;
      const raw = await llm.complete(fullPrompt);
      let parsed: Record<string, unknown>;
      try {
        parsed = parseJsonResponse(raw);
      } catch {
        lastError = "response was not valid JSON";
        continue;
      }
      const validated = schema.safeParse(parsed.data);
      if (!validated.success) {
        lastError = validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        continue;
      }
      // Teach: persist the selectors the LLM identified, for free re-runs.
      if (store && page.html) {
        const taught = sanitizeRecipe(parsed.selectors, page.html, url);
        if (Object.keys(taught).length > 0) {
          store.set(origin, hash, taught);
        }
      }
      return {
        data: validated.data,
        meta: {
          method: "llm",
          provider: llm.name,
          recipeCached: recipe !== null,
          ms: Math.round(performance.now() - started),
        },
        scrape: page.result,
      };
    }

    throw new AscrapError(
      "extraction_failed",
      `LLM output did not validate against the schema after one repair retry (${lastError}).`,
    );
  } finally {
    store?.close();
  }
}

/**
 * Scrape a URL and extract structured, schema-valid data from it.
 * First visit for an origin + schema uses the LLM once and caches a
 * deterministic selector recipe; later visits run at zero LLM cost until
 * the recipe stops validating.
 */
export async function extract<T extends ZodRawShape>(
  url: string,
  schema: ZodObject<T>,
  options: ExtractOptions = {},
): Promise<ExtractResult<z.infer<ZodObject<T>>>> {
  const page = await scrapePage(url, options);
  return extractFromPage(page, schema, options);
}

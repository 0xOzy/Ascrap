#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import { AscrapError, crawl, scrape } from "@ascrap/core";

const program = new Command();

program
  .name("ascrap")
  .description(
    "Ascrap — MCP-native, TypeScript-first web scraping for AI agents.",
  )
  .version("0.1.0");

program
  .command("scrape")
  .description("Scrape one URL into clean, token-reported Markdown")
  .argument("<url>", "the URL to scrape")
  .option("--max-tokens <n>", "hard token cap / fit budget (paragraph-boundary truncation)", (v) =>
    Number.parseInt(v, 10),
  )
  .option("--query <text>", "focus query for --fit pruning")
  .option("--fit", "prune the Markdown to the blocks most relevant to --query")
  .option("--out <file>", "write Markdown to a file instead of stdout")
  .option("--json", "print the full result object as JSON")
  .option("--no-robots", "skip the robots.txt check (explicit opt-out, logged)")
  .option("--no-browser", "disable the Tier 3 browser fallback")
  .option("--cache <file>", "SQLite cache file (results cached, ETag revalidation)")
  .action(async (url: string, opts: Record<string, unknown>) => {
    if (opts.fit && !opts.query) {
      console.error("error [invalid_option]: --fit requires --query <text>.");
      process.exitCode = 1;
      return;
    }
    try {
      const result = await scrape(url, {
        maxTokens: opts.maxTokens as number | undefined,
        query: opts.query as string | undefined,
        fit: opts.fit === true,
        respectRobots: opts.robots !== false,
        browserFallback: opts.browser !== false,
        cachePath: opts.cache as string | undefined,
      });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (opts.out) {
        await writeFile(opts.out as string, result.markdown + "\n", "utf8");
      } else {
        console.log(result.markdown);
      }

      const m = result.meta;
      console.error(
        `\n— ${result.status} · tier ${m.tier} · ${m.extractorUsed} · ` +
          `${m.tokens} tokens (raw HTML: ${m.tokensRawHtml}, saved: ${m.tokensSavedVsHtml}) · ` +
          `${m.ms} ms · robots: ${result.provenance.robots}` +
          (m.cached ? " · cached" : "") +
          (m.fitApplied ? " · fit applied" : "") +
          (m.truncated ? " · content pruned/truncated" : "") +
          (opts.out ? ` · written to ${opts.out as string}` : ""),
      );
    } catch (err) {
      if (err instanceof AscrapError) {
        console.error(`error [${err.code}]: ${err.message}`);
        process.exitCode = 1;
        return;
      }
      throw err;
    }
  });

function slugForUrl(raw: string): string {
  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, "").replace(/^\/+/, "").replace(/\//g, "-");
  const slug = (path || "index").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `${url.hostname}-${slug}`.slice(0, 120);
}

program
  .command("crawl")
  .description("Crawl one origin breadth-first and scrape every page")
  .argument("<url>", "the start URL")
  .option("--max-pages <n>", "maximum pages to fetch (default 50)", (v) =>
    Number.parseInt(v, 10),
  )
  .option("--max-depth <n>", "maximum link depth (default 2)", (v) =>
    Number.parseInt(v, 10),
  )
  .option("--out <dir>", "write one Markdown file per page into this directory")
  .option("--json", "print the full crawl result as JSON")
  .option("--no-robots", "skip robots.txt checks (explicit opt-out, logged)")
  .option("--no-browser", "disable the Tier 3 browser fallback")
  .option("--cache <file>", "SQLite cache file shared across pages")
  .action(async (url: string, opts: Record<string, unknown>) => {
    try {
      const result = await crawl(url, {
        maxPages: opts.maxPages as number | undefined,
        maxDepth: opts.maxDepth as number | undefined,
        respectRobots: opts.robots !== false,
        browserFallback: opts.browser !== false,
        cachePath: opts.cache as string | undefined,
      });

      if (opts.out) {
        const dir = opts.out as string;
        await mkdir(dir, { recursive: true });
        for (const page of result.pages) {
          await writeFile(
            join(dir, `${slugForUrl(page.finalUrl)}.md`),
            page.markdown + "\n",
            "utf8",
          );
        }
        await writeFile(
          join(dir, "crawl-summary.json"),
          JSON.stringify(
            {
              startUrl: result.startUrl,
              ms: result.ms,
              pages: result.pages.map((p) => ({
                url: p.finalUrl,
                title: p.title,
                tokens: p.meta.tokens,
                tier: p.meta.tier,
              })),
              errors: result.errors,
            },
            null,
            2,
          ),
          "utf8",
        );
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      for (const page of result.pages) {
        console.log(`${page.finalUrl} — ${page.meta.tokens} tokens (tier ${page.meta.tier})`);
      }
      for (const err of result.errors) {
        console.error(`error [${err.code}] ${err.url}: ${err.message}`);
      }
      console.error(
        `\n— crawled ${result.pages.length} pages, ${result.errors.length} errors · ${result.ms} ms` +
          (opts.out ? ` · written to ${opts.out as string}` : ""),
      );
      if (result.pages.length === 0) process.exitCode = 1;
    } catch (err) {
      if (err instanceof AscrapError) {
        console.error(`error [${err.code}]: ${err.message}`);
        process.exitCode = 1;
        return;
      }
      throw err;
    }
  });

program
  .command("mcp")
  .description("Run the Ascrap MCP server (arrives in Week 5)")
  .action(() => {
    console.error(
      "The MCP server lands in Week 5 of the v1 roadmap — see docs/BLUEPRINT.md §18.",
    );
    process.exitCode = 1;
  });

await program.parseAsync();

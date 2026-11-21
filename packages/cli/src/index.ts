#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { AscrapError, scrape } from "@ascrap/core";

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
  .option("--max-tokens <n>", "hard token cap (paragraph-boundary truncation)", (v) =>
    Number.parseInt(v, 10),
  )
  .option("--query <text>", "focus query (fit pruning lands in Week 2)")
  .option("--out <file>", "write Markdown to a file instead of stdout")
  .option("--json", "print the full result object as JSON")
  .option("--no-robots", "skip the robots.txt check (explicit opt-out, logged)")
  .action(async (url: string, opts: Record<string, unknown>) => {
    if (opts.query) {
      console.error(
        "note: --query is accepted, but query-focused fit pruning lands in Week 2.",
      );
    }
    try {
      const result = await scrape(url, {
        maxTokens: opts.maxTokens as number | undefined,
        query: opts.query as string | undefined,
        respectRobots: opts.robots !== false,
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
          (m.truncated ? " · truncated by --max-tokens" : "") +
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

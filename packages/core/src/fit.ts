import { countTokens } from "./tokens.js";

export interface FitResult {
  markdown: string;
  /** Blocks kept out of the total blocks in the source Markdown. */
  blocksKept: number;
  blocksTotal: number;
  /** True when at least one block was dropped. */
  pruned: boolean;
}

interface Block {
  index: number;
  text: string;
  isHeading: boolean;
  score: number;
}

/** Split Markdown into blocks on blank lines. */
function splitBlocks(markdown: string): Block[] {
  return markdown
    .split(/\n\n+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      index,
      text,
      isHeading: /^#{1,6}\s/.test(text),
      score: 0,
    }));
}

/** Count case-insensitive occurrences of a term, on word boundaries where possible. */
function termHits(text: string, term: string): number {
  if (!term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches?.length ?? 0;
}

/**
 * Query-focused pruning ("fit" mode).
 *
 * Deterministic — no LLM. Every block is scored by query-term hits
 * (heading hits weigh 3×), the document title block is always kept for
 * context, and blocks are selected greedily by score until the token
 * budget is spent, then restored to document order. If no block matches
 * the query at all, the document head is kept up to the budget instead
 * of returning nothing.
 */
export function applyFit(
  markdown: string,
  query: string,
  tokenBudget: number,
): FitResult {
  const blocks = splitBlocks(markdown);
  if (blocks.length === 0) {
    return { markdown: "", blocksKept: 0, blocksTotal: 0, pruned: false };
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  for (const block of blocks) {
    const lower = block.text.toLowerCase();
    let score = 0;
    for (const term of terms) score += termHits(lower, term);
    if (block.isHeading) score *= 3;
    block.score = score;
  }

  const kept = new Set<number>();
  let used = 0;
  const tryKeep = (block: Block): boolean => {
    const cost = countTokens(block.text);
    if (used + cost > tokenBudget && kept.size > 0) return false;
    kept.add(block.index);
    used += cost;
    return true;
  };

  // Always keep the first block (title / lead context).
  tryKeep(blocks[0]);

  const anyMatch = blocks.some((b) => b.score > 0);
  if (anyMatch) {
    const ranked = [...blocks]
      .filter((b) => b.score > 0 && !kept.has(b.index))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    for (const block of ranked) tryKeep(block);

    // Keep the section heading above any kept block — a paragraph without
    // its heading loses the context an agent needs to cite it correctly.
    for (const block of blocks) {
      if (!kept.has(block.index) || block.isHeading) continue;
      for (let i = block.index - 1; i >= 0; i--) {
        if (blocks[i].isHeading) {
          if (!kept.has(blocks[i].index)) tryKeep(blocks[i]);
          break;
        }
      }
    }
  } else {
    // No signal from the query: fall back to the document head, in order.
    for (const block of blocks.slice(1)) {
      if (!tryKeep(block)) break;
    }
  }

  const selected = blocks
    .filter((b) => kept.has(b.index))
    .map((b) => b.text)
    .join("\n\n");

  return {
    markdown: selected,
    blocksKept: kept.size,
    blocksTotal: blocks.length,
    pruned: kept.size < blocks.length,
  };
}

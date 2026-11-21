import { describe, expect, it } from "vitest";
import { applyFit } from "../src/fit.js";
import { countTokens } from "../src/tokens.js";

const DOC = [
  "# Panduan Kopi Indonesia",
  "Kopi robusta banyak ditanam di Lampung dan Sumatera Selatan. Harga kopi robusta naik pekan ini karena pasokan menurun.",
  "## Wisata Gunung",
  "Gunung Bromo adalah tujuan wisata populer di Jawa Timur. Wisatawan datang untuk melihat matahari terbit dan lautan pasir.",
  "## Harga dan Pasar",
  "Harga kopi robusta di pasar domestik mencapai Rp 1.250.000 per kuintal. Ekspor kopi juga meningkat ke Eropa.",
  "## Olahraga",
  "Tim sepak bola lokal memenangkan pertandingan persahabatan kemarin malam dengan skor dua kosong.",
].join("\n\n");

describe("applyFit", () => {
  it("keeps blocks relevant to the query and drops unrelated ones", () => {
    const result = applyFit(DOC, "harga kopi robusta", 4000);
    expect(result.markdown).toContain("Rp 1.250.000 per kuintal");
    expect(result.markdown).toContain("Harga kopi robusta naik");
    expect(result.markdown).not.toContain("sepak bola");
    expect(result.markdown).not.toContain("Gunung Bromo");
    expect(result.pruned).toBe(true);
    expect(result.blocksKept).toBeLessThan(result.blocksTotal);
  });

  it("always keeps the title block for context", () => {
    const result = applyFit(DOC, "sepak bola", 4000);
    expect(result.markdown).toContain("# Panduan Kopi Indonesia");
    expect(result.markdown).toContain("sepak bola");
  });

  it("respects the token budget", () => {
    const result = applyFit(DOC, "kopi", 40);
    expect(countTokens(result.markdown)).toBeLessThanOrEqual(40);
  });

  it("falls back to the document head when nothing matches", () => {
    const result = applyFit(DOC, "xyzzy tidakada", 60);
    expect(result.markdown).toContain("# Panduan Kopi Indonesia");
    expect(result.blocksKept).toBeGreaterThan(0);
  });

  it("keeps everything when the budget is generous and all blocks match", () => {
    const result = applyFit(DOC, "kopi", 100_000);
    // Off-topic blocks (wisata, olahraga) score 0 and are pruned even here.
    expect(result.markdown).not.toContain("sepak bola");
    expect(result.markdown).toContain("Harga dan Pasar");
  });
});

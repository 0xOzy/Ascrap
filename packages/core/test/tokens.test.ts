import { describe, expect, it } from "vitest";
import { countTokens } from "../src/tokens.js";

describe("countTokens (cl100k_base)", () => {
  it("returns 0 for empty text", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts a short string deterministically", () => {
    const a = countTokens("Harga kopi naik hari ini.");
    const b = countTokens("Harga kopi naik hari ini.");
    expect(a).toBeGreaterThan(0);
    expect(a).toBe(b);
  });

  it("grows with text length", () => {
    const short = countTokens("kopi");
    const long = countTokens("kopi robusta dari Lampung dan Sumatera Selatan");
    expect(long).toBeGreaterThan(short);
  });
});

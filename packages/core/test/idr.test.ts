import { describe, expect, it } from "vitest";
import { findIdrAmounts, parseIdr } from "../src/idr.js";

describe("parseIdr", () => {
  it("parses dot-grouped thousands with an Rp prefix", () => {
    expect(parseIdr("Rp 1.250.000")).toBe(1_250_000);
    expect(parseIdr("Rp1.250.000,00")).toBe(1_250_000);
    expect(parseIdr("IDR 99.000")).toBe(99_000);
    expect(parseIdr("rp 500")).toBe(500);
  });

  it("parses magnitude words", () => {
    expect(parseIdr("850 ribu")).toBe(850_000);
    expect(parseIdr("Rp 850 ribu")).toBe(850_000);
    expect(parseIdr("1,25 juta")).toBe(1_250_000);
    expect(parseIdr("2,5 miliar")).toBe(2_500_000_000);
    expect(parseIdr("750rb")).toBe(750_000);
  });

  it("parses plain Indonesian-formatted numbers", () => {
    expect(parseIdr("1.250.000")).toBe(1_250_000);
    expect(parseIdr("99.000")).toBe(99_000);
  });

  it("does not misread an English decimal as thousands", () => {
    expect(parseIdr("1.5")).toBe(2); // 1.5 rounds to 2 rupiah — no thousand grouping
    expect(parseIdr("bukan harga")).toBeNull();
    expect(parseIdr("")).toBeNull();
  });
});

describe("findIdrAmounts", () => {
  it("extracts all marked amounts from prose, in order", () => {
    const text =
      "Harga kopi Rp 1.250.000 per kuintal, ongkir 25 ribu, dan diskon sampai 1,5 juta untuk member.";
    expect(findIdrAmounts(text)).toEqual([1_250_000, 25_000, 1_500_000]);
  });

  it("ignores bare numbers without markers", () => {
    expect(findIdrAmounts("Ada 3 item dan 42 halaman.")).toEqual([]);
  });

  it("finds the amount in the golden article fixture language", () => {
    expect(findIdrAmounts("tercatat naik menjadi Rp 1.250.000 per kuintal")).toEqual([
      1_250_000,
    ]);
  });
});

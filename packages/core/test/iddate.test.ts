import { describe, expect, it } from "vitest";
import { parseIndonesianDate } from "../src/iddate.js";

describe("parseIndonesianDate", () => {
  it("parses full Indonesian month names", () => {
    expect(parseIndonesianDate("Jakarta, 21 November 2026")).toBe("2026-11-21");
    expect(parseIndonesianDate("terbit 5 Mei 2026")).toBe("2026-05-05");
    expect(parseIndonesianDate("17 Agustus 1945")).toBe("1945-08-17");
    expect(parseIndonesianDate("1 Januari 2027")).toBe("2027-01-01");
    expect(parseIndonesianDate("31 Desember 2026")).toBe("2026-12-31");
  });

  it("parses abbreviated month names", () => {
    expect(parseIndonesianDate("3 Agu 2026")).toBe("2026-08-03");
    expect(parseIndonesianDate("9 Okt 2026")).toBe("2026-10-09");
    expect(parseIndonesianDate("14 Feb 2026")).toBe("2026-02-14");
  });

  it("parses day-first numeric dates", () => {
    expect(parseIndonesianDate("21/11/2026")).toBe("2026-11-21");
    expect(parseIndonesianDate("05-01-2027")).toBe("2027-01-05");
  });

  it("rejects impossible and absent dates", () => {
    expect(parseIndonesianDate("31 Februari 2026")).toBeNull();
    expect(parseIndonesianDate("tidak ada tanggal di sini")).toBeNull();
    expect(parseIndonesianDate("")).toBeNull();
  });
});

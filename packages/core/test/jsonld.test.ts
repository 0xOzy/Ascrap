import { describe, expect, it } from "vitest";
import { extractFromHtml } from "../src/extract.js";

const ARTICLE_BODY = [
  "Harga kopi robusta kembali naik pada perdagangan pekan ini di pasar domestik Indonesia.",
  "Kenaikan dipicu menurunnya pasokan dari Lampung dan Sumatera Selatan akibat curah hujan tinggi yang mengganggu proses pengeringan biji kopi di tingkat petani.",
  "Para eksportir memperkirakan harga akan bertahan tinggi hingga musim panen berikutnya, sementara permintaan dari Eropa dan Amerika Serikat tetap kuat sepanjang kuartal ini.",
  "Pemerintah daerah memantau distribusi agar tidak terjadi kelangkaan di tingkat konsumen, dan stok di gudang distributor dinilai masih cukup untuk beberapa pekan ke depan.",
].join("\n");

const HTML_WITH_JSONLD = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Judul Halaman - Situs</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"NewsArticle","headline":"Harga Kopi Naik Lagi","articleBody":${JSON.stringify(ARTICLE_BODY)}}
</script></head>
<body><nav>Beranda Ekonomi Politik</nav><main><p>Teaser pendek.</p></main></body></html>`;

describe("Tier 0 — JSON-LD extraction", () => {
  it("prefers a full JSON-LD articleBody over DOM scraping", () => {
    const result = extractFromHtml(HTML_WITH_JSONLD, "https://example.co.id/berita/1");
    expect(result.extractorUsed).toBe("json-ld");
    expect(result.title).toBe("Harga Kopi Naik Lagi");
    expect(result.markdown).toContain("Harga kopi robusta kembali naik");
    expect(result.markdown).toContain("stok di gudang distributor");
  });

  it("ignores JSON-LD without an article body and falls through", () => {
    const html = `<!doctype html><html><head><title>Situs</title>
      <script type="application/ld+json">{"@type":"WebSite","name":"Contoh"}</script></head>
      <body><article><h1>Artikel Biasa</h1><p>${"Isi artikel yang cukup panjang untuk lolos dari ekstraksi. ".repeat(10)}</p></article></body></html>`;
    const result = extractFromHtml(html, "https://example.co.id/a");
    expect(result.extractorUsed).not.toBe("json-ld");
  });
});

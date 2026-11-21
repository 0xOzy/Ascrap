<div align="center">

# Ascrap

### Web, siap untuk agent kamu.

**Framework web scraping untuk AI agent yang MCP-native dan TypeScript-first — Markdown bersih hemat token dan JSON valid terhadap skema dari URL apa pun. Local-first. Tanpa API key.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Status: v1 dikerjakan](https://img.shields.io/badge/Status-v1%20Sedang%20Dikerjakan-orange.svg)](./docs/BLUEPRINT.md)
[![MCP Native](https://img.shields.io/badge/MCP-Native-purple.svg)](#-mcp-server)
[![TypeScript First](https://img.shields.io/badge/TypeScript-First-3178C6.svg)](#-rencana-penggunaan-v1)

[Blueprint](./docs/BLUEPRINT.md) · [Etika](./ETHICS.md) · [Berkontribusi](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

</div>

> **Bahasa:** [English](./README.md) | **Bahasa Indonesia**

---

## Kenapa Ascrap?

AI agent tidak membaca web seperti manusia, dan tidak men-scrape-nya seperti crawler klasik. Agent menemukan **URL yang tidak dikenal di tengah tugas** dan membutuhkannya saat itu juga:

- **Konten bersih, bukan HTML** — Markdown atau JSON yang muat di context window-nya
- **Token sesedikit mungkin** — boilerplate secara harfiah adalah uang yang dibakar
- **Tool yang bisa dipanggil** — permukaan MCP / function-calling yang kecil dan terdeskripsi jelas, dengan skema yang ketat
- **Error terstruktur yang bisa ditindaklanjuti** — `blocked`, `needs_browser`, `robots_disallowed`, bukan stack trace

Loader klasik mengembalikan teks mentah penuh sampah navigasi (pada satu studi terukur, ~52% karakter sebuah halaman adalah navigasi). API scraping hosted menyelesaikan ini, tetapi mematoknya dengan kredit yang berlipat diam-diam untuk ekstraksi terstruktur — dan versi self-hosted-nya adalah subset fitur. Framework ekstraksi terbaik saat ini hanya tersedia di Python, sementara ekosistem agent berpusat di TypeScript.

**Ascrap dibangun untuk menutup celah itu.**

## Apa yang membedakannya

| Pilar | Artinya |
| --- | --- |
| **MCP-native, satu sumber skema** | Satu skema Zod menghasilkan API library, tools MCP, definisi function-calling, dan REST API. Tidak ada drift antar-permukaan. |
| **Budget token sebagai API kelas satu** | Minta `maxTokens: 4000` yang difokuskan pada sebuah query — dan dapatkan kembali biaya persisnya: token yang dipakai, token yang dihemat vs HTML mentah, tier dan extractor yang digunakan. |
| **Local-first, fitur lengkap** | Seluruh core berjalan di mesin kamu dengan satu perintah. Tanpa API key, tanpa telemetri, URL kamu tidak pernah meninggalkan mesinmu. Bukan subset dari produk cloud. |
| **Extract once, run free forever** | Kunjungan pertama memakai LLM + skema Zod kamu, lalu menghasilkan dan meng-cache ekstraktor deterministik. Scraping berikutnya berbiaya nol token LLM sampai skor kepercayaannya turun. |
| **Paket resep Indonesia / Asia Tenggara** | Resep teruji untuk situs publik Indonesia: parsing IDR yang benar (`Rp 1.250.000` → `1250000`), tanggal dan boilerplate Bahasa Indonesia, profil locale ID. |
| **Polite by default** | `robots.txt` dihormati secara default, rate limit per domain, identitas bot yang jujur, sadar Content Signals dan HTTP 402 — dengan catatan provenance di setiap hasil. |
| **Jujur soal anti-bot** | Ascrap berhenti dan melaporkan `blocked` alih-alih diam-diam menaikkan biaya. Tidak ada janji "Cloudflare bypass" — lihat [ETHICS.md](./ETHICS.md). |

## Cara kerjanya

Ascrap mengambil halaman secara bertingkat — **tidak pernah browser-first**:

```text
Tier 0  API resmi situs / JSON-LD / RSS / sitemap / llms.txt      (termurah, paling stabil)
Tier 1  HTTP fetch + TLS impersonation                            ~40–300 ms
Tier 2  Ekstraksi kelas Readability pada HTML tersebut
Tier 3  Browser headless (Playwright) — hanya jika Tier 1 kosong / ter-gate JS
Tier 4  Browser stealth (Patchright) — hanya jika Tier 3 ditantang
Tier 5  BERHENTI, laporkan blocked — jangan pernah eskalasi biaya diam-diam
```

HTML mentah artikel pada umumnya ~17 rb token. Sebuah reader membawanya ke ~4,7–5,9 rb. Pruning yang difokuskan pada query bisa membawanya ke ~1,5 rb. Ascrap melaporkan angka-angka ini di **setiap** hasil, dan menyertakan harness evaluasi publik berisi 50 situs agar klaimnya dapat direproduksi — bukan sekadar pemasaran.

## Rencana penggunaan (v1)

> **Status:** Implementasi v1 **sedang berjalan — Minggu 1–3 sudah jadi**: monorepo, paket skema Zod, JSON-LD Tier 0 + fetching Tier 1 + ekstraksi Readability, fallback Playwright Tier 3 untuk halaman ter-gate JS, perintah CLI `ascrap scrape` dan `ascrap crawl`, cache SQLite dengan revalidasi ETag, pruning `fit` terfokus query, serta parser IDR & tanggal Bahasa Indonesia semuanya sudah bisa dijalankan dari repo ini (`npm install && npm run build`). Sisa permukaan API adalah target desain v1; publikasi npm tiba bersama v1.0.

### Library

```ts
import { scrape, extract } from "ascrap";
import { z } from "zod";

// Satu halaman -> Markdown bersih dengan budget token
const page = await scrape("https://example.co.id/artikel", {
  maxTokens: 4000,
  query: "harga dan ketersediaan",
  fit: true,
});

console.log(page.markdown);
console.log(page.meta); // { tokens, tokensSavedVsHtml, tier, extractorUsed, ms }
console.log(page.provenance); // { url, fetchedAt, robots: "allowed" }

// Satu halaman + satu skema Zod -> JSON tervalidasi
const Product = z.object({
  name: z.string(),
  priceIdr: z.number(), // "Rp 1.250.000" -> 1250000, parser IDR bawaan
  currency: z.literal("IDR"),
  inStock: z.boolean(),
});

const product = await extract("https://example.co.id/produk/123", { schema: Product });
```

### MCP server

Lima tool kecil — `scrape`, `extract`, `crawl`, `map`, `watch` — dirancang agar bekerja di Claude Code, Cursor, dan MCP client lain dalam waktu kurang dari satu menit, **tanpa API key** untuk core lokal:

```json
{
  "mcpServers": {
    "ascrap": {
      "command": "npx",
      "args": ["-y", "ascrap", "mcp"]
    }
  }
}
```

### CLI

```bash
npx ascrap scrape https://example.co.id/artikel --max-tokens 4000 --query "harga"
npx ascrap crawl https://docs.example.co.id --max-pages 100 --out ./docs-md/
npx ascrap extract https://example.co.id/produk/123 --schema ./product.zod.ts
npx ascrap mcp    # jalankan MCP server (stdio)
npx ascrap eval   # reproduksi tabel benchmark pada korpus 50 situs
```

## Kasus penggunaan

1. **Ingesti RAG** — crawl situs docs / help menjadi Markdown terstruktur heading dengan metadata sitasi & provenance
2. **Research agent** — search → baca → sintesis, tanpa membakar context untuk boilerplate
3. **Pipeline terstruktur** — produk, lowongan, listing, dan data perusahaan sebagai JSON valid terhadap skema, tanpa selector yang ditulis manual
4. **Monitoring perubahan untuk agent** — `watch(url, schema)` hanya mengembalikan diff semantik, bukan seluruh halaman lagi
5. **Agent lokal & personal** — membaca web dari mesin kamu sendiri, secara privat, dengan LLM lokal

## Status proyek & roadmap

| Fase | Ruang lingkup | Status |
| --- | --- | --- |
| **Blueprint** | Riset pasar & kompetitor, arsitektur, desain API, roadmap 6 minggu | ✅ Selesai — lihat [`docs/BLUEPRINT.md`](./docs/BLUEPRINT.md) |
| **v1.0** | Fetching Tier 1–3, Markdown + mode fit dengan laporan token, ekstraksi Zod, MCP server (5 tool), CLI, cache SQLite, harness eval 50 situs, 3 resep Indonesia, Docker satu perintah | 🚧 Berjalan — Minggu 1–3 selesai (scaffold, fit, parser, fallback browser, crawl, cache) |
| **v1.5** | Cache ekstraksi code-gen, `watch` dengan diff semantik, REST API terautentikasi, wrapper LangChain.js / LlamaIndex, lebih banyak resep ID | Direncanakan |
| **v2.0** | Hanya jika usage nyata muncul: demo hosted, resep komunitas, SDK Python tipis di atas MCP/REST | Eksploratif |

Secara eksplisit **di luar ruang lingkup**: penyediaan proxy/IP, penyelesaian CAPTCHA, scraping login atau paywall, dan browser agent visual (mengklik / mengisi formulir) — Ascrap menyediakan datanya; ia berintegrasi dengan browser agent, bukan bersaing dengan mereka.

## Dokumentasi

- 📐 **[Blueprint Lengkap](./docs/BLUEPRINT.md)** — riset, lanskap kompetitor, arsitektur, ADR, desain eval, postur hukum & etika, dan roadmap v1 minggu per minggu ([English version](./docs/BLUEPRINT.en.md))
- 🤝 **[ETHICS.md](./ETHICS.md)** — aturan polite-by-default yang wajib diikuti setiap resep dan kontribusi
- 🛠 **[CONTRIBUTING.md](./CONTRIBUTING.md)** — cara berkontribusi, termasuk garis merah resep
- 📋 **[CHANGELOG.md](./CHANGELOG.md)** — riwayat versi (SemVer sejak hari pertama)

## English Summary

**Ascrap** is an open-source web scraping framework designed specifically for AI agents: TypeScript-first, MCP-native, and local-first (no API key required). From any URL, Ascrap produces clean, token-efficient Markdown or schema-valid JSON — with token counts and a provenance record on every result. Its differentiators include code-gen extraction (the LLM is used once; repeat scrapes are free), a recipe pack for Indonesian public sites (including IDR price and Bahasa Indonesia date parsers), and a polite-by-default posture that respects `robots.txt`. The full blueprint is available in [`docs/BLUEPRINT.en.md`](./docs/BLUEPRINT.en.md).

## Lisensi

Dilisensikan di bawah **Apache License 2.0** — lihat [LICENSE](./LICENSE).

Apache-2.0 dipilih dengan sengaja: grant paten dan keramahan terhadap embedding komersial yang tidak ditawarkan AGPL (yang dipakai sebagian kompetitor hosted) untuk proyek berskala portofolio.

---

<div align="center">

Dibangun oleh [@0xOzy](https://github.com/0xOzy) · Blueprint v1.0 — 21 November 2026

</div>

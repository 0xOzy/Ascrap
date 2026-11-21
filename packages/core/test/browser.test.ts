import { describe, expect, it } from "vitest";
import { looksJsGated, proxyFromEnv } from "../src/browser.js";

describe("proxyFromEnv", () => {
  it("parses an authenticated proxy URL and the NO_PROXY bypass list", () => {
    const proxy = proxyFromEnv({
      HTTPS_PROXY: "http://user:secret@proxy.example:3128",
      NO_PROXY: "localhost,127.0.0.1",
    });
    expect(proxy?.server).toBe("http://proxy.example:3128");
    expect(proxy?.username).toBe("user");
    expect(proxy?.password).toBe("secret");
    expect(proxy?.bypass).toBe("localhost,127.0.0.1");
  });

  it("returns undefined when no proxy is configured", () => {
    expect(proxyFromEnv({})).toBeUndefined();
  });
});

const LONG_PROSE = Array.from(
  { length: 12 },
  (_, i) =>
    `Paragraf nomor ${i + 1} berisi penjelasan panjang tentang proses sangrai kopi robusta dan dampaknya terhadap cita rasa akhir minuman.`,
).join("\n\n");

describe("looksJsGated", () => {
  it("flags an empty extraction from a large document", () => {
    const html = `<html><body>${"<script>var x=1;</script>".repeat(200)}</body></html>`;
    expect(looksJsGated(html, "")).toBe(true);
  });

  it("flags an SPA mount with a JavaScript notice", () => {
    const html =
      `<html><body><div id="root"></div>` +
      `<p>You need to enable JavaScript to run this app.</p>` +
      `${"<script src='/static/js/main.js'></script>".repeat(80)}</body></html>`;
    expect(looksJsGated(html, "You need to enable JavaScript")).toBe(true);
  });

  it("flags link-dominated output (navigation only, content is JS-injected)", () => {
    const markdown =
      "[Login](https://example.co.id/login)\n\n- [Berikutnya](https://example.co.id/page/2)";
    const html = `<html><body>${"<div>shell</div>".repeat(50)}</body></html>`;
    expect(looksJsGated(html, markdown)).toBe(true);
  });

  it("does not flag a content-rich page", () => {
    const html = `<html><body><article>${LONG_PROSE}</article></body></html>`;
    expect(looksJsGated(html, LONG_PROSE)).toBe(false);
  });

  it("does not flag a small page with little content", () => {
    const html = "<html><body><p>Halo</p></body></html>";
    expect(looksJsGated(html, "Halo")).toBe(false);
  });
});

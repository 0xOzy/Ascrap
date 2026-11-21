import { AscrapError } from "./errors.js";
import { countTokens } from "./tokens.js";

/**
 * Heuristic: does this page look JavaScript-gated from its static HTML?
 * True when extraction produced (almost) nothing while the raw document is
 * substantial, or the page explicitly says it needs JavaScript / mounts an
 * empty SPA root. Deliberately conservative — Tier 3 is expensive, so a
 * false positive costs far more than a false negative.
 */
export function looksJsGated(html: string, markdown: string): boolean {
  if (!markdown.trim()) return html.length > 2_000;
  const tokens = countTokens(markdown);
  // Link-dominated output is navigation, not content: a JS app whose static
  // shell only yields menu links has effectively extracted nothing.
  if (tokens < 100) {
    const linkTextChars = [...markdown.matchAll(/\[([^\]]*)\]\([^)]*\)/g)]
      .map((m) => m[1].length)
      .reduce((a, b) => a + b, 0);
    // Compare against *visible* text (link syntax stripped), not raw Markdown.
    const visibleChars = markdown
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim().length;
    if (visibleChars > 0 && linkTextChars / visibleChars > 0.7) return true;
  }
  if (tokens >= 30) return false;
  // An empty SPA mount point or an explicit "needs JavaScript" notice is a
  // strong signal at any document size — SPA shells are often small files
  // that load large external bundles.
  const spaMount =
    /<div[^>]+id=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(html) ||
    /enable javascript|requires javascript|needs javascript/i.test(html);
  if (spaMount) return true;
  // Otherwise require a substantial document with almost no readable text.
  return html.length > 60_000;
}

export interface BrowserFetch {
  html: string;
  finalUrl: string;
  status: number;
}

interface PlaywrightProxy {
  server: string;
  username?: string;
  password?: string;
  /** Comma-separated bypass list, from NO_PROXY — local addresses must not tunnel. */
  bypass?: string;
}

/**
 * Chromium does not read proxy environment variables, while the fetch tier
 * (Node) increasingly does. Bridge the gap: when HTTPS_PROXY / HTTP_PROXY
 * is set, hand it to the browser explicitly so both tiers reach the same
 * network — common behind corporate and sandboxed egress proxies.
 */
export function proxyFromEnv(
  env: Record<string, string | undefined> = process.env,
): PlaywrightProxy | undefined {
  const raw =
    env.HTTPS_PROXY ?? env.https_proxy ?? env.HTTP_PROXY ?? env.http_proxy;
  if (!raw) return undefined;
  const bypass = env.NO_PROXY ?? env.no_proxy;
  try {
    const url = new URL(raw);
    return {
      server: `${url.protocol}//${url.host}`,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      bypass,
    };
  } catch {
    return { server: raw, bypass };
  }
}

/**
 * Tier 3: render a page in headless Chromium via Playwright and return the
 * rendered HTML. Playwright is an optional dependency, imported lazily so
 * the core stays light for users who never need a browser.
 */
export async function fetchWithBrowser(
  url: string,
  userAgent: string,
  timeoutMs: number,
): Promise<BrowserFetch> {
  let chromium: {
    launch: (opts: {
      headless: boolean;
      proxy?: PlaywrightProxy;
    }) => Promise<{
      newPage: (opts: { userAgent: string }) => Promise<{
        goto: (
          url: string,
          opts: { waitUntil: string; timeout: number },
        ) => Promise<{ status: () => number } | null>;
        content: () => Promise<string>;
        url: () => string;
      }>;
      close: () => Promise<void>;
    }>;
  };
  try {
    const specifier = "playwright";
    const pw = (await import(/* @vite-ignore */ specifier)) as {
      chromium: typeof chromium;
    };
    chromium = pw.chromium;
  } catch {
    throw new AscrapError(
      "needs_browser",
      "This page needs JavaScript rendering, but Playwright is not installed. " +
        "Install it with: npm install playwright && npx playwright install chromium",
    );
  }

  const browser = await chromium.launch({
    headless: true,
    proxy: proxyFromEnv(),
  });
  try {
    const page = await browser.newPage({ userAgent });
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: timeoutMs,
    });
    const html = await page.content();
    return {
      html,
      finalUrl: page.url(),
      status: response?.status() ?? 200,
    };
  } catch (cause) {
    throw new AscrapError(
      "needs_browser",
      `Browser rendering failed for ${url}: ${(cause as Error).message}`,
    );
  } finally {
    await browser.close();
  }
}

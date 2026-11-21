import { DatabaseSync } from "node:sqlite";
import type { ScrapeResult } from "@ascrap/schema";

export interface CachedEntry {
  result: ScrapeResult;
  etag: string | null;
  /** Epoch milliseconds when the entry was stored. */
  storedAt: number;
}

/**
 * SQLite result cache (built-in `node:sqlite` — zero dependencies).
 * One row per normalized URL, storing the full result JSON plus the
 * origin ETag for conditional revalidation.
 */
export class ScrapeCache {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS scrape_cache (
         url TEXT PRIMARY KEY,
         result TEXT NOT NULL,
         etag TEXT,
         stored_at INTEGER NOT NULL
       )`,
    );
  }

  get(url: string): CachedEntry | null {
    const row = this.db
      .prepare("SELECT result, etag, stored_at FROM scrape_cache WHERE url = ?")
      .get(url) as
      | { result: string; etag: string | null; stored_at: number }
      | undefined;
    if (!row) return null;
    return {
      result: JSON.parse(row.result) as ScrapeResult,
      etag: row.etag,
      storedAt: row.stored_at,
    };
  }

  set(url: string, result: ScrapeResult, etag: string | null): void {
    this.db
      .prepare(
        `INSERT INTO scrape_cache (url, result, etag, stored_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET result = excluded.result,
           etag = excluded.etag, stored_at = excluded.stored_at`,
      )
      .run(url, JSON.stringify(result), etag, Date.now());
  }

  /** Refresh an entry's timestamp after a successful 304 revalidation. */
  touch(url: string): void {
    this.db
      .prepare("UPDATE scrape_cache SET stored_at = ? WHERE url = ?")
      .run(Date.now(), url);
  }

  close(): void {
    this.db.close();
  }
}

/** Is a cached entry still within its freshness window? */
export function isFresh(entry: CachedEntry, maxAgeSeconds: number): boolean {
  return Date.now() - entry.storedAt <= maxAgeSeconds * 1_000;
}

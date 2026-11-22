import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OllamaProvider } from "../src/llm.js";
import { AscrapError } from "../src/errors.js";

describe("OllamaProvider timeout reporting", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // A server that accepts the request but answers far too slowly.
    server = createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ response: "{}" }));
      }, 1_000);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("reports a slow model as timed out, not as unreachable", async () => {
    const provider = new OllamaProvider("any-model", baseUrl, 50);
    try {
      await provider.complete("hello");
      expect.unreachable("slow provider must throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AscrapError);
      expect((err as AscrapError).code).toBe("llm_unavailable");
      expect((err as Error).message).toContain("timed out");
      expect((err as Error).message).not.toContain("not reachable");
    }
  });
});

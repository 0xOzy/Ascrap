import { AscrapError } from "./errors.js";

/**
 * The LLM rung sits behind this one-method interface so providers stay
 * swappable and the core never depends on a vendor SDK.
 * Implementations must return the model's raw text output.
 */
export interface LlmProvider {
  readonly name: string;
  complete(prompt: string): Promise<string>;
}

function assertOk(res: Response, provider: string): void {
  if (!res.ok) {
    throw new AscrapError(
      "llm_unavailable",
      `${provider} request failed with HTTP ${res.status}`,
    );
  }
}

/** Local models via Ollama — the default, key-free provider. */
export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";
  constructor(
    private readonly model: string = "llama3.1",
    private readonly baseUrl: string = "http://localhost:11434",
  ) {}

  async complete(prompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: "json",
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (cause) {
      throw new AscrapError(
        "llm_unavailable",
        `Ollama is not reachable at ${this.baseUrl} — is it running? (${(cause as Error).message})`,
      );
    }
    assertOk(res, "Ollama");
    const body = (await res.json()) as { response?: string };
    return body.response ?? "";
  }
}

/** Any OpenAI-compatible chat endpoint (OpenAI, OpenRouter, vLLM, …). */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  constructor(
    private readonly model: string,
    private readonly baseUrl: string = "https://api.openai.com/v1",
    private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY,
    name = "openai-compatible",
  ) {
    this.name = name;
  }

  async complete(prompt: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (cause) {
      throw new AscrapError(
        "llm_unavailable",
        `${this.name} request failed: ${(cause as Error).message}`,
      );
    }
    assertOk(res, this.name);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? "";
  }
}

/**
 * Deterministic provider for tests and offline demos: returns queued
 * responses in order and records every prompt it received.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  readonly prompts: string[] = [];
  private queue: string[];

  constructor(responses: string[]) {
    this.queue = [...responses];
  }

  async complete(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    const next = this.queue.shift();
    if (next === undefined) {
      throw new AscrapError(
        "llm_unavailable",
        "MockLlmProvider has no queued response left",
      );
    }
    return next;
  }
}

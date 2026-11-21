import type { AscrapErrorCode } from "@ascrap/schema";

/** Error with a structured, agent-actionable code — never a bare stack trace. */
export class AscrapError extends Error {
  readonly code: AscrapErrorCode;

  constructor(code: AscrapErrorCode, message: string) {
    super(message);
    this.name = "AscrapError";
    this.code = code;
  }
}

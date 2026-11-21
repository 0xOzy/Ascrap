import { encode } from "gpt-tokenizer";

/**
 * Count tokens with the cl100k_base tokenizer.
 * The tokenizer is always named in output/docs — token numbers are only
 * comparable when the tokenizer is stated (blueprint §12).
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}

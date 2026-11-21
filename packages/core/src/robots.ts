import robotsParser from "robots-parser";

export type RobotsDecision = "allowed" | "disallowed" | "unavailable";

/**
 * Fetch and evaluate robots.txt for `targetUrl`.
 * A missing or unreachable robots.txt is treated as "unavailable"
 * (conventionally: allowed, but reported honestly in provenance).
 */
export async function checkRobots(
  targetUrl: URL,
  userAgent: string,
  timeoutMs: number,
): Promise<RobotsDecision> {
  const robotsUrl = new URL("/robots.txt", targetUrl.origin);
  try {
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404) return "unavailable";
    if (!res.ok) return "unavailable";
    const body = await res.text();
    const robots = robotsParser(robotsUrl.toString(), body);
    return robots.isAllowed(targetUrl.toString(), userAgent)
      ? "allowed"
      : "disallowed";
  } catch {
    return "unavailable";
  }
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function hashApiKey(key: string): string { return createHash("sha256").update(key).digest("hex"); }

export function verifyGitHubSignature(rawBody: string, signature: string | undefined, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export class SlidingWindowRateLimiter {
  private readonly events = new Map<string, number[]>();
  allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const active = (this.events.get(key) ?? []).filter((time) => time > now - windowMs);
    if (active.length >= limit) return false;
    active.push(now); this.events.set(key, active); return true;
  }
}

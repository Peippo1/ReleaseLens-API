import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { SlidingWindowRateLimiter, verifyGitHubSignature } from "../src/security.js";

describe("GitHub webhook verification", () => {
  it("accepts a valid SHA-256 signature and rejects tampering", () => {
    const body = '{"ok":true}'; const secret = "top-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect(verifyGitHubSignature(body, signature, secret)).toBe(true);
    expect(verifyGitHubSignature("{}", signature, secret)).toBe(false);
  });
});
describe("rate limit", () => {
  it("limits requests inside a window", () => {
    const limiter = new SlidingWindowRateLimiter();
    expect(limiter.allow("t", 2, 1000, 100)).toBe(true); expect(limiter.allow("t", 2, 1000, 200)).toBe(true); expect(limiter.allow("t", 2, 1000, 300)).toBe(false); expect(limiter.allow("t", 2, 1000, 1200)).toBe(true);
  });
});

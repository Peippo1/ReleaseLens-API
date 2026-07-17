import { describe, expect, it } from "vitest";
import { extractEvidence } from "../src/analysis.js";

describe("evidence extraction", () => {
  it("detects a removed exported API", () => {
    const evidence = extractEvidence({ files: [{ path: "src/client.ts", status: "modified", patch: "- export function legacyClient() {}\n+ export function modernClient() {}" }], commits: [] });
    expect(evidence.exportedApiChanges).toContainEqual({ path: "src/client.ts", symbol: "legacyClient", change: "removed" });
    expect(evidence.signals).toContain("Public export removed: legacyClient (src/client.ts)");
  });
  it("detects a major dependency change", () => {
    const evidence = extractEvidence({ files: [{ path: "package.json", status: "modified", patch: '- "library": "^1.2.0"\n+ "library": "^2.0.0"' }], commits: [] });
    expect(evidence.dependencyChanges).toContainEqual({ name: "library", from: "^1.2.0", to: "^2.0.0", major: true });
  });
  it("flags unsupported-only changes as low confidence", () => {
    expect(extractEvidence({ files: [{ path: "main.go", status: "modified", patch: "+ package main" }], commits: [] }).confidence).toBe("low");
  });
});

import { describe, expect, it } from "vitest";
import { fallbackReport } from "../src/analysis.js";
import { createReportSchema, reportContentSchema } from "../src/domain.js";

describe("public contracts", () => {
  it("rejects incomplete report requests", () => {
    expect(() => createReportSchema.parse({ repository: "bad repository", base: "", head: "x" })).toThrow();
  });
  it("rejects malformed LLM report output", () => {
    expect(() => reportContentSchema.parse({ publicNotes: [] })).toThrow();
  });
  it("uses a low-confidence fallback for incomplete evidence", () => {
    const report = fallbackReport({ changedPaths: [], commits: [], exportedApiChanges: [], dependencyChanges: [], signals: [], confidence: "medium", incomplete: true });
    expect(report.confidence).toBe("low");
  });
});

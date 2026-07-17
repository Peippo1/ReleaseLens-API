import { describe, expect, it } from "vitest";
import { StaticSynthesizer } from "../src/adapters.js";
import { MemoryJobQueue, MemoryReportStore } from "../src/store.js";
import { ReportService } from "../src/service.js";

const content = { publicNotes: ["Added search."], internalBrief: "Safe change.", breakingChanges: [], migrationSteps: [], rolloutChecklist: ["Deploy"], evidence: ["src/search.ts"], confidence: "high" as const };
describe("report service", () => {
  it("isolates tenant reports and processes a queued report", async () => {
    const store = new MemoryReportStore(); const service = new ReportService(store, new MemoryJobQueue(), { compare: async () => ({ files: [{ path: "src/search.ts", status: "added", patch: "+ export const search = () => {}" }], commits: [{ sha: "abc", message: "feat: search" }] }) }, new StaticSynthesizer(content));
    const report = await service.create("tenant-a", { repository: "acme/web", base: "one", head: "two", installationId: 42 });
    expect(await service.read("tenant-b", report.id)).toBeUndefined();
    expect((await service.processNext())?.status).toBe("completed");
    expect((await service.read("tenant-a", report.id))?.content).toEqual(content);
    expect(await service.delete("tenant-a", report.id)).toBe(true);
    expect(await service.read("tenant-a", report.id)).toBeUndefined();
  });
});

import { randomUUID } from "node:crypto";
import { createReportSchema, type ChangeSet, type Report, type ReportContent } from "./domain.js";
import { extractEvidence, fallbackReport } from "./analysis.js";
import type { JobQueue, ReportStore } from "./store.js";

export interface ChangeSource { compare(repository: string, base: string, head: string, installationId: number): Promise<ChangeSet>; }
export interface ReportSynthesizer { synthesize(evidence: ReturnType<typeof extractEvidence>): Promise<ReportContent>; }

export class ReportService {
  constructor(private readonly store: ReportStore, private readonly jobs: JobQueue, private readonly changes: ChangeSource, private readonly synthesizer: ReportSynthesizer) {}
  async create(tenantId: string, input: unknown): Promise<Report> {
    const request = createReportSchema.parse(input);
    const report: Report = { id: randomUUID(), tenantId, ...request, status: "queued", createdAt: new Date().toISOString() };
    await this.store.create(report); await this.jobs.enqueue(report.id); return report;
  }
  async read(tenantId: string, id: string): Promise<Report | undefined> { const report = await this.store.get(id); return report?.tenantId === tenantId ? report : undefined; }
  async delete(tenantId: string, id: string): Promise<boolean> { const report = await this.read(tenantId, id); if (!report) return false; await this.store.delete(id); return true; }
  async processNext(): Promise<Report | undefined> {
    const id = await this.jobs.dequeue(); if (!id) return undefined;
    const report = await this.store.get(id); if (!report) return undefined;
    report.status = "running"; await this.store.update(report);
    try {
      const evidence = extractEvidence(await this.changes.compare(report.repository, report.base, report.head, report.installationId));
      report.content = evidence.confidence === "low" ? fallbackReport(evidence) : await this.synthesizer.synthesize(evidence);
      report.status = "completed"; report.completedAt = new Date().toISOString();
    } catch { report.status = "failed"; report.errorCode = "ANALYSIS_FAILED"; }
    await this.store.update(report); return report;
  }
}

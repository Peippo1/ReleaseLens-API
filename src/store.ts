import type { Report } from "./domain.js";

export interface ReportStore {
  create(report: Report): Promise<void>;
  get(id: string): Promise<Report | undefined>;
  update(report: Report): Promise<void>;
  delete(id: string): Promise<void>;
}
export class MemoryReportStore implements ReportStore {
  private readonly reports = new Map<string, Report>();
  async create(report: Report) { this.reports.set(report.id, report); }
  async get(id: string) { return this.reports.get(id); }
  async update(report: Report) { this.reports.set(report.id, report); }
  async delete(id: string) { this.reports.delete(id); }
}

export interface JobQueue { enqueue(reportId: string): Promise<void>; dequeue(): Promise<string | undefined>; }
export class MemoryJobQueue implements JobQueue {
  private readonly jobs: string[] = [];
  async enqueue(id: string) { this.jobs.push(id); }
  async dequeue() { return this.jobs.shift(); }
}

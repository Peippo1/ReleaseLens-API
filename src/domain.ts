import { z } from "zod";

export const audienceSchema = z.enum(["public", "internal", "both"]);
export const createReportSchema = z.object({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "repository must be owner/name"),
  base: z.string().min(1).max(200),
  head: z.string().min(1).max(200),
  installationId: z.number().int().positive(),
  audience: audienceSchema.default("both")
});

export const evidenceSchema = z.object({
  changedPaths: z.array(z.string()).max(500),
  commits: z.array(z.object({ sha: z.string(), message: z.string().max(500) })).max(250),
  exportedApiChanges: z.array(z.object({ path: z.string(), symbol: z.string(), change: z.enum(["added", "removed"]) })),
  dependencyChanges: z.array(z.object({ name: z.string(), from: z.string().nullable(), to: z.string().nullable(), major: z.boolean() })),
  signals: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  incomplete: z.boolean()
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const reportContentSchema = z.object({
  publicNotes: z.array(z.string()).max(20),
  internalBrief: z.string().max(6000),
  breakingChanges: z.array(z.string()).max(20),
  migrationSteps: z.array(z.string()).max(20),
  rolloutChecklist: z.array(z.string()).max(20),
  evidence: z.array(z.string()).max(100),
  confidence: z.enum(["low", "medium", "high"])
});
export type ReportContent = z.infer<typeof reportContentSchema>;

export type ReportStatus = "queued" | "running" | "completed" | "failed";
export interface Report {
  id: string;
  tenantId: string;
  repository: string;
  base: string;
  head: string;
  installationId: number;
  audience: z.infer<typeof audienceSchema>;
  status: ReportStatus;
  content?: ReportContent;
  errorCode?: "ANALYSIS_FAILED" | "UNSUPPORTED_CHANGESET";
  createdAt: string;
  completedAt?: string;
}

export interface ChangeSet {
  files: Array<{ path: string; status: "added" | "modified" | "removed"; patch?: string }>;
  commits: Array<{ sha: string; message: string }>;
}

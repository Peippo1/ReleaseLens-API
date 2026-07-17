import { Redis } from "@upstash/redis";
import { Pool } from "pg";
import { z } from "zod";
import { reportContentSchema, type ChangeSet, type Evidence, type Report, type ReportContent } from "./domain.js";
import type { ChangeSource, ReportSynthesizer } from "./service.js";
import type { JobQueue, ReportStore } from "./store.js";

export class PostgresReportStore implements ReportStore {
  constructor(private readonly pool: Pool) {}
  async create(report: Report) { await this.pool.query(`INSERT INTO reports (id, tenant_id, repository, base_ref, head_ref, installation_id, audience, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [report.id, report.tenantId, report.repository, report.base, report.head, report.installationId, report.audience, report.status, report.createdAt]); }
  async get(id: string): Promise<Report | undefined> {
    const result = await this.pool.query(`SELECT id, tenant_id, repository, base_ref, head_ref, installation_id, audience, status, content, error_code, created_at, completed_at FROM reports WHERE id = $1`, [id]);
    const row = result.rows[0]; if (!row) return undefined;
    return { id: row.id, tenantId: row.tenant_id, repository: row.repository, base: row.base_ref, head: row.head_ref, installationId: row.installation_id, audience: row.audience, status: row.status, content: row.content ?? undefined, errorCode: row.error_code ?? undefined, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() };
  }
  async update(report: Report) { await this.pool.query(`UPDATE reports SET status=$2, content=$3, error_code=$4, completed_at=$5 WHERE id=$1`, [report.id, report.status, report.content ? JSON.stringify(report.content) : null, report.errorCode ?? null, report.completedAt ?? null]); }
  async delete(id: string) { await this.pool.query("DELETE FROM reports WHERE id = $1", [id]); await this.pool.query("INSERT INTO deletion_audit (report_id, deleted_at) VALUES ($1, now())", [id]); }
}

export class RedisJobQueue implements JobQueue {
  constructor(private readonly redis: Redis) {}
  async enqueue(id: string) { await this.redis.rpush("releaselens:jobs", id); }
  async dequeue() { return (await this.redis.lpop<string>("releaselens:jobs")) ?? undefined; }
}

export class GitHubChangeSource implements ChangeSource {
  constructor(private readonly token: string) {}
  async compare(repository: string, base: string, head: string): Promise<ChangeSet> {
    const [owner, repo] = repository.split("/");
    const headers = { authorization: `Bearer ${this.token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, { headers });
    if (!response.ok) throw new Error("GitHub comparison failed");
    const payload = await response.json() as { files?: Array<{ filename: string; status: string; patch?: string }>; commits?: Array<{ sha: string; commit: { message: string } }> };
    return { files: (payload.files ?? []).map((file) => ({ path: file.filename, status: file.status === "removed" ? "removed" : file.status === "added" ? "added" : "modified", patch: file.patch })), commits: (payload.commits ?? []).map((commit) => ({ sha: commit.sha, message: commit.commit.message })) };
  }
}

export class OpenAiSynthesizer implements ReportSynthesizer {
  constructor(private readonly apiKey: string, private readonly model: string) {}
  async synthesize(evidence: Evidence): Promise<ReportContent> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: [{ role: "system", content: "Generate release intelligence only from supplied evidence. Do not infer undocumented behavior. Return JSON matching the schema." }, { role: "user", content: JSON.stringify(evidence) }],
        text: { format: { type: "json_schema", name: "release_report", strict: true, schema: {
          type: "object", additionalProperties: false,
          required: ["publicNotes", "internalBrief", "breakingChanges", "migrationSteps", "rolloutChecklist", "evidence", "confidence"],
          properties: {
            publicNotes: { type: "array", items: { type: "string" } }, internalBrief: { type: "string" },
            breakingChanges: { type: "array", items: { type: "string" } }, migrationSteps: { type: "array", items: { type: "string" } },
            rolloutChecklist: { type: "array", items: { type: "string" } }, evidence: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["low", "medium", "high"] }
          }
        } } }
      })
    });
    if (!response.ok) throw new Error("LLM request failed");
    const payload = await response.json() as { output_text?: string };
    return reportContentSchema.parse(JSON.parse(payload.output_text ?? ""));
  }
}

export class StaticSynthesizer implements ReportSynthesizer {
  constructor(private readonly report: ReportContent) {}
  async synthesize() { return reportContentSchema.parse(this.report); }
}

export function createProductionAdapters() {
  const databaseUrl = process.env.DATABASE_URL; const redisUrl = process.env.UPSTASH_REDIS_REST_URL; const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!databaseUrl || !redisUrl || !redisToken) throw new Error("Service storage is not configured");
  return { store: new PostgresReportStore(new Pool({ connectionString: databaseUrl })), jobs: new RedisJobQueue(new Redis({ url: redisUrl, token: redisToken })) };
}

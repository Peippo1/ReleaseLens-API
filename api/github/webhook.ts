import type { IncomingMessage, ServerResponse } from "node:http";
import { json, rawBody, safeError } from "../../src/http.js";
import { serviceFor } from "../../src/runtime.js";
import { verifyGitHubSignature } from "../../src/security.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") return json(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
  const raw = await rawBody(request);
  if (!process.env.GITHUB_WEBHOOK_SECRET || !verifyGitHubSignature(raw, request.headers["x-hub-signature-256"] as string | undefined, process.env.GITHUB_WEBHOOK_SECRET)) return json(response, 401, { error: { code: "INVALID_SIGNATURE" } });
  try {
    const event = request.headers["x-github-event"]; const payload = JSON.parse(raw) as any;
    if (event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged) {
      const service = serviceFor();
      const report = await service.create(`github:${payload.installation.account.id}`, { repository: payload.repository.full_name, base: payload.pull_request.base.sha, head: payload.pull_request.merge_commit_sha, installationId: payload.installation.id, audience: "both" });
      return json(response, 202, { data: { reportId: report.id } });
    }
    if (event === "release" && payload.action === "published") {
      const service = serviceFor();
      const report = await service.create(`github:${payload.installation.account.id}`, { repository: payload.repository.full_name, base: payload.release.target_commitish, head: payload.release.tag_name, installationId: payload.installation.id, audience: "both" });
      return json(response, 202, { data: { reportId: report.id } });
    }
    return json(response, 202, { data: { ignored: true } });
  } catch (error) { return safeError(response, error); }
}

import type { IncomingMessage, ServerResponse } from "node:http";
import { json, safeError } from "../../../src/http.js";
import { serviceFor, tenantFromAuthorization } from "../../../src/runtime.js";

export default async function handler(request: IncomingMessage & { query?: { id?: string; installationId?: string } }, response: ServerResponse) {
  if (request.method !== "GET") return json(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
  const tenantId = tenantFromAuthorization(request.headers.authorization); const id = request.query?.id;
  if (!tenantId || !id) return json(response, 401, { error: { code: "UNAUTHORIZED" } });
  try {
    const report = await serviceFor().read(tenantId, id);
    if (!report) return json(response, 404, { error: { code: "NOT_FOUND" } });
    return json(response, 200, { data: report, markdown: report.content ? { publicNotes: report.content.publicNotes.map((line) => `- ${line}`).join("\n"), internalBrief: report.content.internalBrief } : undefined });
  } catch (error) { return safeError(response, error); }
}

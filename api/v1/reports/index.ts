import type { IncomingMessage, ServerResponse } from "node:http";
import { json, rawBody, safeError } from "../../../src/http.js";
import { rateLimiter, serviceFor, tenantFromAuthorization } from "../../../src/runtime.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") return json(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
  const tenantId = tenantFromAuthorization(request.headers.authorization);
  if (!tenantId) return json(response, 401, { error: { code: "UNAUTHORIZED", message: "A valid tenant API key is required." } });
  if (!rateLimiter.allow(tenantId, 30, 60_000)) return json(response, 429, { error: { code: "RATE_LIMITED" } });
  try {
    const body = await rawBody(request); if (Buffer.byteLength(body) > 32_768) return json(response, 413, { error: { code: "PAYLOAD_TOO_LARGE" } });
    const input = JSON.parse(body) as { installationId?: number };
    if (!Number.isInteger(input.installationId)) return json(response, 400, { error: { code: "INVALID_REQUEST", message: "installationId is required." } });
    const service = serviceFor();
    const report = await service.create(tenantId, input);
    return json(response, 202, { data: report });
  } catch (error) { return safeError(response, error); }
}

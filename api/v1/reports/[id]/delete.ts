import type { IncomingMessage, ServerResponse } from "node:http";
import { json, rawBody, safeError } from "../../../../src/http.js";
import { serviceFor, tenantFromAuthorization } from "../../../../src/runtime.js";

export default async function handler(request: IncomingMessage & { query?: { id?: string } }, response: ServerResponse) {
  if (request.method !== "POST") return json(response, 405, { error: { code: "METHOD_NOT_ALLOWED" } });
  const tenantId = tenantFromAuthorization(request.headers.authorization); const id = request.query?.id;
  if (!tenantId || !id) return json(response, 401, { error: { code: "UNAUTHORIZED" } });
  try {
    await rawBody(request); // consume body before responding; deletion needs no GitHub credential.
    const deleted = await serviceFor().delete(tenantId, id);
    return deleted ? json(response, 204, undefined) : json(response, 404, { error: { code: "NOT_FOUND" } });
  } catch (error) { return safeError(response, error); }
}

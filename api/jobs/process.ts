import type { IncomingMessage, ServerResponse } from "node:http";
import { json, safeError } from "../../src/http.js";
import { serviceFor } from "../../src/runtime.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.headers.authorization !== `Bearer ${process.env.INTERNAL_JOB_TOKEN}`) return json(response, 401, { error: { code: "UNAUTHORIZED" } });
  try {
    const service = serviceFor();
    const report = await service.processNext(); return json(response, 200, { data: { processed: report?.id ?? null } });
  } catch (error) { return safeError(response, error); }
}

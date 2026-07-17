import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";

export async function rawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
export function json(response: ServerResponse, status: number, data: unknown) { response.statusCode = status; response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify(data)); }
export function safeError(response: ServerResponse, error: unknown) {
  if (error instanceof ZodError) return json(response, 400, { error: { code: "INVALID_REQUEST", message: "Request payload is invalid." } });
  return json(response, 500, { error: { code: "INTERNAL_ERROR", message: "Unable to process request." } });
}
export function markdown(lines: string[]) { return lines.map((line) => `- ${line}`).join("\n"); }

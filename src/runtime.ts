import { createProductionAdapters, GitHubChangeSource, OpenAiSynthesizer } from "./adapters.js";
import { ReportService, type ChangeSource } from "./service.js";
import { hashApiKey, SlidingWindowRateLimiter } from "./security.js";
import { createAppAuth } from "@octokit/auth-app";

export function tenantFromAuthorization(value: string | undefined): string | undefined {
  const token = value?.replace(/^Bearer\s+/i, ""); if (!token) return undefined;
  const configured = process.env.TENANT_API_KEYS?.split(",") ?? [];
  const hash = hashApiKey(token);
  return configured.find((entry) => entry.endsWith(`:${hash}`))?.split(":")[0];
}
export async function githubInstallationToken(installationId: number): Promise<string> {
  const appId = process.env.GITHUB_APP_ID; const privateKey = process.env.GITHUB_PRIVATE_KEY_BASE64;
  if (!appId || !privateKey) throw new Error("GitHub App is not configured");
  const auth = createAppAuth({ appId, privateKey: Buffer.from(privateKey, "base64").toString("utf8") });
  const result = await auth({ type: "installation", installationId });
  return result.token;
}
export function serviceFor() {
  const { store, jobs } = createProductionAdapters();
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  if (!process.env.OPENAI_API_KEY) throw new Error("LLM provider is not configured");
  return new ReportService(store, jobs, { compare: async (repository, base, head, installationId) => new GitHubChangeSource(await githubInstallationToken(installationId)).compare(repository, base, head) }, new OpenAiSynthesizer(process.env.OPENAI_API_KEY, model));
}
export const rateLimiter = new SlidingWindowRateLimiter();

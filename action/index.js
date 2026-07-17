import { appendFileSync } from "node:fs";

const core = process.env;
const required = (name) => { const value = core[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`]; if (!value) throw new Error(`Missing required input: ${name}`); return value; };
const output = (name, value) => {
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  const marker = `RELEASELENS_${name.replace(/[^A-Za-z0-9]/g, "_")}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${marker}\n${value}\n${marker}\n`);
};

async function run() {
  const apiUrl = required("api-url").replace(/\/$/, "");
  const apiKey = required("api-key");
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error("GITHUB_REPOSITORY is required.");
  const create = await fetch(`${apiUrl}/v1/reports`, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ repository, base: required("base"), head: required("head"), installationId: Number(required("installation-id")), audience: "both" }) });
  if (!create.ok) throw new Error(`ReleaseLens API returned ${create.status}`);
  const report = (await create.json()).data; output("report-id", report.id);
  if ((core.INPUT_WAIT ?? "true") !== "true") return;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const poll = await fetch(`${apiUrl}/v1/reports/${report.id}`, { headers: { authorization: `Bearer ${apiKey}` } });
    if (!poll.ok) throw new Error(`Unable to read report (${poll.status})`);
    const current = (await poll.json()).data;
    if (current.status === "completed") {
      const notes = current.content.publicNotes.map((line) => `- ${line}`).join("\n"); output("public-notes", notes);
      const pullNumber = process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\//)?.[1];
      if (core.INPUT_COMMENT === "true" && pullNumber && process.env.GITHUB_TOKEN) {
        const comment = await fetch(`https://api.github.com/repos/${repository}/issues/${pullNumber}/comments`, { method: "POST", headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" }, body: JSON.stringify({ body: `## ReleaseLens notes\n\n${notes}` }) });
        if (!comment.ok) throw new Error(`Unable to post PR comment (${comment.status})`);
      }
      return;
    }
    if (current.status === "failed") throw new Error("ReleaseLens analysis failed.");
  }
  throw new Error("ReleaseLens report did not complete before timeout.");
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });

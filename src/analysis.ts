import type { ChangeSet, Evidence, ReportContent } from "./domain.js";

const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
const EXPORTED = /^[-+]\s*export\s+(?:default\s+)?(?:class|function|const|interface|type)\s+([A-Za-z_$][\w$]*)/gm;

function packageVersions(patch: string | undefined): Map<string, { from: string | null; to: string | null }> {
  const values = new Map<string, { from: string | null; to: string | null }>();
  for (const line of (patch ?? "").split("\n")) {
    const match = line.match(/^([+-])\s*"([^"\s]+)"\s*:\s*"([^"]+)"/);
    if (!match || match[2] === "version") continue;
    const entry = values.get(match[2]) ?? { from: null, to: null };
    if (match[1] === "-") entry.from = match[3]; else entry.to = match[3];
    values.set(match[2], entry);
  }
  return values;
}
function isMajor(from: string | null, to: string | null): boolean {
  if (!from || !to) return false;
  const a = from.replace(/^[^0-9]*/, "").split(".")[0];
  const b = to.replace(/^[^0-9]*/, "").split(".")[0];
  return Boolean(a && b && a !== b);
}

export function extractEvidence(changeSet: ChangeSet): Evidence {
  const paths = changeSet.files.map((file) => file.path).slice(0, 500);
  const api = changeSet.files.filter((file) => SOURCE.test(file.path)).flatMap((file) => {
    const changes: Evidence["exportedApiChanges"] = [];
    for (const match of (file.patch ?? "").matchAll(EXPORTED)) changes.push({ path: file.path, symbol: match[1], change: match[0].startsWith("-") ? "removed" : "added" });
    return changes;
  });
  const dependencies = changeSet.files.filter((file) => /(^|\/)package(?:-lock)?\.json$/.test(file.path)).flatMap((file) =>
    [...packageVersions(file.patch).entries()].map(([name, version]) => ({ name, ...version, major: isMajor(version.from, version.to) }))
  );
  const signals = [
    ...api.filter((item) => item.change === "removed").map((item) => `Public export removed: ${item.symbol} (${item.path})`),
    ...dependencies.filter((item) => item.major).map((item) => `Major dependency change: ${item.name}`),
    ...changeSet.commits.filter((commit) => /BREAKING CHANGE|!:/i.test(commit.message)).map((commit) => `Breaking-change commit: ${commit.sha.slice(0, 7)}`)
  ];
  const supported = changeSet.files.some((file) => SOURCE.test(file.path) || /package(?:-lock)?\.json$/.test(file.path));
  return { changedPaths: paths, commits: changeSet.commits.slice(0, 250), exportedApiChanges: api, dependencyChanges: dependencies, signals, confidence: !supported ? "low" : signals.length ? "high" : "medium", incomplete: changeSet.files.length >= 500 };
}

export function fallbackReport(evidence: Evidence): ReportContent {
  const changes = evidence.signals.length ? evidence.signals : ["No deterministic breaking-change signals were detected."];
  return {
    publicNotes: evidence.incomplete ? ["Release includes changes; review is required because the change set was truncated."] : ["Release includes internal improvements and maintenance updates."],
    internalBrief: evidence.incomplete ? "Analysis is incomplete because the change set exceeded the supported limit." : "Generated from deterministic repository evidence; review before publishing.",
    breakingChanges: evidence.signals.filter((s) => /removed|major|breaking/i.test(s)),
    migrationSteps: evidence.signals.length ? ["Review the detected changes and update affected consumers before rollout."] : [],
    rolloutChecklist: ["Review generated notes", "Run the repository test suite", "Monitor errors after deployment"],
    evidence: changes,
    confidence: evidence.incomplete ? "low" : evidence.confidence
  };
}

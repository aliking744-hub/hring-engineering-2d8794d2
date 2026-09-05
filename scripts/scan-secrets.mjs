import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const forbiddenSecretFiles = /(^|\/)(\.env($|\.(?!example$|standalone\.example$))|[^/]+\.(pem|key|p12|pfx))$/i;
const skippedFiles = /(^|\/)(node_modules|dist|\.git)\//;
const skippedNames = /(^|\/)(package-lock\.json|bun\.lock|FULL_CODE_EXPORT\.md)$/;

const highConfidencePatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/],
  ["OpenAI project key", /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Stripe live key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
];

const literalAssignment =
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|secret[_-]?key|password)\b\s*[:=]\s*["'`](?<value>[^"'\`\r\n]{16,})["'`]/gi;
const placeholder = /(?:example|sample|placeholder|change[-_]?me|replace[-_]?me|your[-_]|dummy|fake|test[-_]|xxxxx|<[^>]+>|\$\{|process\.env|os\.getenv)/i;

const listed = spawnSync("git", ["ls-files", "-z"], { encoding: "utf8" });
if (listed.status !== 0) {
  console.error("Secret scan could not list tracked files.");
  process.exit(2);
}

const findings = [];
for (const path of listed.stdout.split("\0").filter(Boolean)) {
  if (skippedFiles.test(path)) continue;

  if (forbiddenSecretFiles.test(path)) {
    findings.push({ path, line: 1, kind: "tracked secret file" });
    continue;
  }

  if (skippedNames.test(path)) continue;

  let size;
  try {
    size = statSync(path).size;
  } catch {
    continue;
  }
  if (size > MAX_FILE_BYTES) continue;

  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue;

  for (const [kind, pattern] of highConfidencePatterns) {
    const match = pattern.exec(text);
    if (match) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ path, line, kind });
    }
  }

  if (/^(?:src|apps|scripts|\.github)\//.test(path) && !/(^|\/)(?:tests?|fixtures?)\//.test(path)) {
    for (const match of text.matchAll(literalAssignment)) {
      const value = match.groups?.value ?? "";
      if (placeholder.test(value)) continue;
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ path, line, kind: "hard-coded credential assignment" });
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.line} (${finding.kind})`);
  }
  console.error("Remove the secret, rotate it if it was real, and use runtime secret storage.");
  process.exit(1);
}

console.log("Secret scan passed: no high-confidence secrets found in tracked files.");

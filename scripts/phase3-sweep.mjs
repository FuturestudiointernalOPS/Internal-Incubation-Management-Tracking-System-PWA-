/**
 * Phase 3 sweep — classify every remaining role-string gate on SENSITIVE routes.
 * Read-only scan. Output: file:line, allowlist, verdict.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "app", "api");
const files = [];
const walk = (directory) => {
  for (const entryName of readdirSync(directory)) {
    const entryPath = join(directory, entryName);
    if (statSync(entryPath).isDirectory()) walk(entryPath);
    else if (entryName === "route.js") files.push(entryPath);
  }
};
walk(root);

const requireAuthPattern = /requireAuth\(\s*\[([^\]]*)\]/g;
const SENSITIVE = /(finance|security|permissions|users|merge|duplicates|run-migration|data|gmail|investor|approve|reject|bulk|invite|org-membership|program-staff|curriculum|access-profiles)/i;

let total = 0;
const findings = [];
for (const file of files) {
  const src = readFileSync(file, "utf-8");
  if (!SENSITIVE.test(file)) continue;
  for (const match of src.matchAll(requireAuthPattern)) {
    total++;
    const roles = match[1].split(",").map((roleToken) => roleToken.trim().replace(/["'`]/g, "")).filter(Boolean);
    const line = src.slice(0, match.index).split("\n").length;
    findings.push({ file: file.replace(process.cwd() + "\\", "").replace(/\\/g, "/"), line, roles: roles.join(",") });
  }
}
console.log(`sensitive-route role gates found: ${total}`);
for (const finding of findings) console.log(`${finding.file}:${finding.line}  [${finding.roles}]`);

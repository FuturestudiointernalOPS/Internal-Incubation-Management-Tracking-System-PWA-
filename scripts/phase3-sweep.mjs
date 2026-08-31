/**
 * Phase 3 sweep — classify every remaining role-string gate on SENSITIVE routes.
 * Read-only scan. Output: file:line, allowlist, verdict.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "app", "api");
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e === "route.js") files.push(p);
  }
};
walk(root);

const re = /requireAuth\(\s*\[([^\]]*)\]/g;
const SENSITIVE = /(finance|security|permissions|users|merge|duplicates|run-migration|data|gmail|investor|approve|reject|bulk|invite|org-membership|program-staff|curriculum|access-profiles)/i;

let total = 0;
const findings = [];
for (const f of files) {
  const src = readFileSync(f, "utf-8");
  if (!SENSITIVE.test(f)) continue;
  for (const m of src.matchAll(re)) {
    total++;
    const roles = m[1].split(",").map((s) => s.trim().replace(/["'`]/g, "")).filter(Boolean);
    const line = src.slice(0, m.index).split("\n").length;
    findings.push({ file: f.replace(process.cwd() + "\\", "").replace(/\\/g, "/"), line, roles: roles.join(",") });
  }
}
console.log(`sensitive-route role gates found: ${total}`);
for (const x of findings) console.log(`${x.file}:${x.line}  [${x.roles}]`);

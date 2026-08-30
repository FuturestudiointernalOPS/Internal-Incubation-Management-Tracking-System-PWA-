/** Read-only scan: role gates (requireAuth / createHandler / requireSession) that EXCLUDE super_admin. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(e)) files.push(p);
  }
};
walk(root);

const reRequireAuth = /requireAuth\(\s*\[([^\]]*)\]/g;
const reCreateHandler = /createHandler\(\s*\{\s*roles:\s*\[([^\]]*)\]/g;
const reRequireSession = /requireSession\(\s*\[([^\]]*)\]/g;

const results = [];
for (const f of files) {
  const src = readFileSync(f, "utf-8");
  for (const [re, kind] of [[reRequireAuth, "requireAuth"], [reCreateHandler, "createHandler"], [reRequireSession, "requireSession"]]) {
    for (const m of src.matchAll(re)) {
      const roles = m[1].split(",").map((s) => s.trim().replace(/["'`]/g, "")).filter(Boolean);
      if (roles.length && !roles.includes("super_admin")) {
        const line = src.slice(0, m.index).split("\n").length;
        results.push({ file: f.replace(process.cwd() + "\\", "").replace(/\\/g, "/"), kind, line, roles: roles.join(", ") });
      }
    }
  }
}
console.log(`Gates excluding super_admin: ${results.length}`);
for (const r of results) console.log(`${r.file}:${r.line} [${r.kind}] roles=${r.roles}`);

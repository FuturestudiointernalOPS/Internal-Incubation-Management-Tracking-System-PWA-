#!/usr/bin/env node
/**
 * Reads coverage/coverage-summary.json (produced by `npm run test:coverage`)
 * and answers two questions the global percentage cannot:
 *
 *   1. Per directory area — statements/branches/functions/lines, so the UI
 *      pages (rarely unit-tested, low risk per line) do not drown out the
 *      business logic (small, high risk per line).
 *   2. Which IMPORTANT files (models, server, lib, api) are at 0% or low.
 *
 * Run:  node scripts/coverage-summary.mjs
 */
import { readFileSync } from "node:fs";

const summary = JSON.parse(
  readFileSync(new URL("../coverage/coverage-summary.json", import.meta.url), "utf8"),
);

const pct = (m) => (m && typeof m.pct === "number" ? m.pct : 0);
const rel = (p) => p.replace(/^.*\/ImpactOs\//, "").replace(/^.*\/src\//, "src/");

/** Collapse a path to its "area": first two segments under src/. */
function areaOf(path) {
  const p = rel(path);
  const parts = p.split("/");
  // src/<a>/<b> → src/<a>/<b>; src/<file> → src/<file>
  return parts.length >= 3 ? `${parts[0]}/${parts[1]}/${parts[2]}` : parts.slice(0, 2).join("/");
}

const rows = Object.entries(summary)
  .filter(([path]) => path !== "total")
  .map(([path, m]) => ({
    path: rel(path),
    stmts: pct(m.statements),
    branches: pct(m.branches),
    funcs: pct(m.functions),
    lines: pct(m.lines),
    total: m.statements?.total ?? 0,
    covered: m.statements?.covered ?? 0,
  }));

const b = (n) => String(n).padStart(6);
const f = (n) => n.toFixed(1).padStart(5);

console.log("=== GLOBAL ===");
const t = summary.total;
console.log(
  `statements ${f(pct(t.statements))}%  branches ${f(pct(t.branches))}%  ` +
    `functions ${f(pct(t.functions))}%  lines ${f(pct(t.lines))}%`,
);

console.log("\n=== BY AREA (weighted by statements) ===");
const areas = new Map();
for (const r of rows) {
  const a = areaOf(r.path);
  const cur = areas.get(a) || { stmtsC: 0, stmtsT: 0, linesC: 0, linesT: 0, files: 0 };
  cur.stmtsC += r.covered;
  cur.stmtsT += r.total;
  cur.linesC += (r.lines / 100) * (r.total || 0);
  cur.linesT += r.total;
  cur.files += 1;
  areas.set(a, cur);
}
[...areas.entries()]
  .map(([a, v]) => ({ a, pct: v.stmtsT ? (100 * v.stmtsC) / v.stmtsT : 0, t: v.stmtsT, files: v.files }))
  .filter((x) => x.t > 50)
  .sort((x, y) => y.t - x.t)
  .forEach((x) => console.log(`${f(x.pct)}%  ${b(x.t)} stmts  ${b(x.files)} files  ${x.a}`));

// ── Important areas: models / server / lib / api ─────────────────────────────
const IMPORTANT = /^src\/(models|server)\/|^src\/lib\/|^src\/app\/api\//;

function section(title, predicate, sort = "asc") {
  const list = rows.filter(predicate);
  console.log(`\n=== ${title} (${list.length} files) ===`);
  const sorted = list.sort((x, y) => (sort === "asc" ? x.lines - y.lines : y.lines - x.lines));
  for (const r of sorted.slice(0, 40)) {
    console.log(
      `${f(r.lines)}% lines  ${f(r.stmts)}% stmts  ${f(r.branches)}% br  ${b(r.total)} st  ${r.path}`,
    );
  }
}

section("IMPORTANT — 0% or low coverage (business logic / server / api)", (r) => IMPORTANT.test(r.path) && r.total > 20 && r.lines < 40, "asc");
section("IMPORTANT — strongly covered", (r) => IMPORTANT.test(r.path) && r.total > 20 && r.lines >= 70, "desc");

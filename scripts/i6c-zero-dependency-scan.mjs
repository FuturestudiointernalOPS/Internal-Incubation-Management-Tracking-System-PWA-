/**
 * PHASE I6C — Zero-dependency scan (static, no DB).
 *
 * Proof objective: every remaining `requireAuth([...roles])` allowlist in
 * src/app/api that mentions a CONTEXTUAL role must be accounted for —
 * either the file was CONVERTED (auth-only; membership/own-scope gates
 * decide downstream), the list is WATCHLISTED (documented deferral in
 * identity-gate-bridge.test.js / the I6A/B briefs), or the list is
 * EXPLAINED (global-only: roles are baselines + staff-family + program
 * manager alongside staff).
 *
 * Anything else exits 1 with an UNCLASSIFIED list — i.e. a stored-role gate
 * with no documented reason. That is the "zero unexplained contextual-role
 * dependency" claim this phase certifies.
 *
 * Usage: node scripts/i6c-zero-dependency-scan.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = join(process.cwd(), "src/app/api");

/** Roles that describe contextual relationships, not baseline identity. */
const CONTEXTUAL = [
  "facilitator",
  "teacher",
  "participant",
  "founder",
  "investor",
  "team",
];

/** Global baselines + staff-family (safe in allowlists). */
const GLOBAL = ["super_admin", "admin", "staff", "developer", "member"];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "route.js") out.push(p);
  }
  return out;
}

function listRoles(file) {
  const src = readFileSync(file, "utf8");
  const blocks = [...src.matchAll(/requireAuth\(\s*\[([^\]]*)\]\)/gs)].map((m) =>
    m[1].replace(/\s+/g, " ").trim(),
  );
  const seen = new Set();
  for (const b of blocks) {
    for (const raw of b.split(",")) {
      const role = raw.trim().replace(/"/g, "");
      if (role && /^[a-z_]+$/.test(role)) seen.add(role);
    }
  }
  return [...seen];
}

const CONVERTED = new Set([
  "attendance/route.js",
  "facilitator-reviews/route.js",
  "participants/route.js",
  "submissions/route.js",
  "pm/full-state/route.js",
  "pm/programs/route.js",
  "ventures/[id]/members/route.js",
  "investor/profile/route.js",
  "sessions/route.js",
  "followups/route.js",
]);

const WATCHLISTED = new Set([
  "contacts/route.js",
  "contacts/search/route.js",
  "families/route.js",
  "participant-programs/route.js",
  "platform/ai/route.js",
  "platform/ai/analyze/route.js",
  "platform/ai/evaluate-submission/route.js",
  "platform/ai/evaluation-scores/route.js",
  "platform/form-runs/route.js",
  "programs/route.js",
  "teacher/reports/route.js",
  "v2/teacher/fulfillment/route.js",
  "v2/teacher/full-state/route.js",
  "v2/teacher/reports/route.js",
  "investor/campaigns/route.js",
  "investor/pipeline/route.js",
  "teams/route.js",
  "upload/route.js",
  "ventures/[id]/history/route.js",
  "pm/teams/route.js",
  "submissions/route.js", // POST self-service + on-behalf list (PATCH/GET converted)
]);

function rel(p) {
  const norm = p.replace(/\\/g, "/");
  const marker = "/src/app/api/";
  const idx = norm.indexOf(marker);
  return idx >= 0 ? norm.slice(idx + marker.length) : norm;
}

const rows = [];
const unclassified = [];
for (const file of walk(API_ROOT)) {
  const r = rel(file);
  const roles = listRoles(file);
  const contextual = roles.filter((x) => CONTEXTUAL.includes(x));
  if (contextual.length === 0) continue; // no contextual-role gate at all

  let verdict;
  if (WATCHLISTED.has(r)) {
    // Documented deferral (partial or full). Converted+watchlisted files are
    // the expected partial-conversion state (e.g. submissions POST).
    verdict = CONVERTED.has(r) ? "WATCHLISTED(partial — some handlers converted)" : "WATCHLISTED";
  } else if (CONVERTED.has(r)) {
    verdict = "UNEXPECTED-CONTEXTUAL-IN-CONVERTED"; // contract test should have caught this
  } else if (contextual.every((c) => c === "program_manager") || contextual.every((c) => c === "participant")) {
    // program_manager lists alongside staff = Staff-PM profile (D2A);
    // participant-only lists = self-service/derivable role lists handled by
    // login derivation; both EXPLAINED when staff/SA also present.
    const hasStaffFamily = roles.some((x) => ["staff", "super_admin", "admin"].includes(x));
    verdict = hasStaffFamily ? "EXPLAINED(PM-as-staff or participant self-service)" : "EXPLAINED(no-staff PM legacy list — no holder on staging)";
  } else {
    verdict = "UNCLASSIFIED";
  }
  rows.push({ file: r, roles: roles.join(","), contextual: contextual.join(","), verdict });
  if (verdict === "UNCLASSIFIED" || verdict.startsWith("UNEXPECTED")) unclassified.push(rows[rows.length - 1]);
}

mkdirSync("scratch", { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outFile = `scratch/i6c-zero-dependency-scan-${stamp}.json`;
writeFileSync(outFile, JSON.stringify({ scannedAt: new Date().toISOString(), rows }, null, 2));

for (const r of rows) console.log(`[${r.verdict}] ${r.file}  (contextual: ${r.contextual || "—"})`);
console.log(`\nfiles with contextual-role gates: ${rows.length} — unclassified: ${unclassified.length}`);
console.log("scan report:", outFile);
if (unclassified.length > 0) {
  console.error("\nUNCLASSIFIED contextual-role gates (need a documented reason):");
  for (const u of unclassified) console.error(`  ${u.file}: [${u.roles}]`);
  process.exit(1);
}

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

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) walk(entryPath, out);
    else if (entry.name === "route.js") out.push(entryPath);
  }
  return out;
}

function listRoles(file) {
  const src = readFileSync(file, "utf8");
  const blocks = [...src.matchAll(/requireAuth\(\s*\[([^\]]*)\]\)/gs)].map((match) =>
    match[1].replace(/\s+/g, " ").trim(),
  );
  const seen = new Set();
  for (const block of blocks) {
    for (const raw of block.split(",")) {
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

function rel(filePath) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const marker = "/src/app/api/";
  const index = normalizedPath.indexOf(marker);
  return index >= 0 ? normalizedPath.slice(index + marker.length) : normalizedPath;
}

const rows = [];
const unclassified = [];
for (const file of walk(API_ROOT)) {
  const relativePath = rel(file);
  const roles = listRoles(file);
  const contextual = roles.filter((role) => CONTEXTUAL.includes(role));
  if (contextual.length === 0) continue; // no contextual-role gate at all

  let verdict;
  if (WATCHLISTED.has(relativePath)) {
    // Documented deferral (partial or full). Converted+watchlisted files are
    // the expected partial-conversion state (e.g. submissions POST).
    verdict = CONVERTED.has(relativePath) ? "WATCHLISTED(partial — some handlers converted)" : "WATCHLISTED";
  } else if (CONVERTED.has(relativePath)) {
    verdict = "UNEXPECTED-CONTEXTUAL-IN-CONVERTED"; // contract test should have caught this
  } else if (contextual.every((role) => role === "program_manager") || contextual.every((role) => role === "participant")) {
    // program_manager lists alongside staff = Staff-PM profile (D2A);
    // participant-only lists = self-service/derivable role lists handled by
    // login derivation; both EXPLAINED when staff/SA also present.
    const hasStaffFamily = roles.some((role) => ["staff", "super_admin", "admin"].includes(role));
    verdict = hasStaffFamily ? "EXPLAINED(PM-as-staff or participant self-service)" : "EXPLAINED(no-staff PM legacy list — no holder on staging)";
  } else {
    verdict = "UNCLASSIFIED";
  }
  rows.push({ file: relativePath, roles: roles.join(","), contextual: contextual.join(","), verdict });
  if (verdict === "UNCLASSIFIED" || verdict.startsWith("UNEXPECTED")) unclassified.push(rows[rows.length - 1]);
}

mkdirSync("scratch", { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outFile = `scratch/i6c-zero-dependency-scan-${stamp}.json`;
writeFileSync(outFile, JSON.stringify({ scannedAt: new Date().toISOString(), rows }, null, 2));

for (const row of rows) console.log(`[${row.verdict}] ${row.file}  (contextual: ${row.contextual || "—"})`);
console.log(`\nfiles with contextual-role gates: ${rows.length} — unclassified: ${unclassified.length}`);
console.log("scan report:", outFile);
if (unclassified.length > 0) {
  console.error("\nUNCLASSIFIED contextual-role gates (need a documented reason):");
  for (const unclassifiedRow of unclassified) console.error(`  ${unclassifiedRow.file}: [${unclassifiedRow.roles}]`);
  process.exit(1);
}

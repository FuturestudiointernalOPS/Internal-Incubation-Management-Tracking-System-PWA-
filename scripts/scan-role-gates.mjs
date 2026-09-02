// READ-ONLY scan: inventory of authorization gate patterns across all API routes.
// Usage: node scripts/scan-role-gates.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API = join(ROOT, "src", "app", "api");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry === "route.js") out.push(p);
  }
  return out;
}

const files = walk(API);

const roleListRe = /roles:\s*\[([^\]]*)\]/g;
const requireAuthRe = /requireAuth\(\s*\[([^\]]*)\]/g;
const requireAuthorizationRe = /requireAuthorization\(\s*"([^"]+)",\s*"([^"]+)"\s*\)/g;
const sessionRoleRe = /session\.role\s*[!=]==?\s*["'][^"']+["']|session\.role\s*&&\s*!?\[[^\]]*\](?:\.includes|\.indexOf)\(session\.role|["'](?:super_admin|staff|program_manager|teacher|participant|investor|mentor|facilitator|admin|developer|team)["'][^;\n]*session\.role/g;
const hasProgramAccessRe = /hasProgramManagementAccess\(|hasProgramAccess\(|requireVentureAccess\(|requireProjectAccess\(|hasVentureAccess\(/g;
const roleGateRe = /session\.role\s*===|session\.role\s*!==|session\.role\s*==|\.includes\(session\.role\)|!\[.*\]\.includes\(session\.role\)/g;

const tally = { filesWithRoleGate: 0, roleGateCount: 0, filesWithRequireAuthRoles: 0, requireAuthRolesCount: 0, filesWithCapabilityGate: 0, capabilityGateCount: 0, filesWithSessionRoleCheck: 0, sessionRoleCheckCount: 0, filesWithAssignmentGate: 0, assignmentGateCount: 0 };
const roleSets = new Map();
const perFile = [];

for (const f of files) {
  const src = readFileSync(f, "utf-8");
  const rel = relative(ROOT, f);
  const entry = { file: rel, roleGates: [], requireAuthRoles: [], capabilityGates: [], sessionRoleChecks: 0, assignmentGates: 0 };

  for (const m of src.matchAll(roleListRe)) {
    const set = m[1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean).join(",");
    entry.roleGates.push(set);
    roleSets.set(set, (roleSets.get(set) || 0) + 1);
  }
  if (entry.roleGates.length) { tally.filesWithRoleGate++; tally.roleGateCount += entry.roleGates.length; }

  for (const m of src.matchAll(requireAuthRe)) {
    entry.requireAuthRoles.push(m[1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean).join(","));
  }
  if (entry.requireAuthRoles.length) { tally.filesWithRequireAuthRoles++; tally.requireAuthRolesCount += entry.requireAuthRoles.length; }

  for (const m of src.matchAll(requireAuthorizationRe)) {
    entry.capabilityGates.push(`${m[1]}.${m[2]}`);
  }
  if (entry.capabilityGates.length) { tally.filesWithCapabilityGate++; tally.capabilityGateCount += entry.capabilityGates.length; }

  entry.sessionRoleChecks = (src.match(roleGateRe) || []).length + (src.match(sessionRoleRe) || []).length;
  if (entry.sessionRoleChecks) { tally.filesWithSessionRoleCheck++; tally.sessionRoleCheckCount += entry.sessionRoleChecks; }

  entry.assignmentGates = (src.match(hasProgramAccessRe) || []).length;
  if (entry.assignmentGates) { tally.filesWithAssignmentGate++; tally.assignmentGateCount += entry.assignmentGates; }

  if (entry.roleGates.length || entry.requireAuthRoles.length || entry.sessionRoleChecks || entry.assignmentGates) perFile.push(entry);
}

console.log(`API route files scanned: ${files.length}`);
console.log(JSON.stringify(tally, null, 2));

console.log(`\n— Distinct role lists used by createHandler({ roles }) —`);
for (const [set, n] of [...roleSets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  [${set}] × ${n}`);
}

console.log(`\n— Files with legacy role gates (createHandler roles / requireAuth([roles]) / session.role) —`);
for (const e of perFile.sort((a, b) => b.roleGates.length + b.requireAuthRoles.length - (a.roleGates.length + a.requireAuthRoles.length))) {
  const bits = [];
  if (e.roleGates.length) bits.push(`roles=[${e.roleGates.join(" | ")}]`);
  if (e.requireAuthRoles.length) bits.push(`requireAuth([${e.requireAuthRoles.join(" | ")}])`);
  if (e.sessionRoleChecks) bits.push(`${e.sessionRoleChecks}×session.role`);
  if (e.assignmentGates) bits.push(`${e.assignmentGates}×assignment-gate`);
  console.log(`  ${e.file} — ${bits.join("; ")}`);
}

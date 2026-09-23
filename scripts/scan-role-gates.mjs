// READ-ONLY scan: inventory of authorization gate patterns across all API routes.
// Usage: node scripts/scan-role-gates.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const API = join(ROOT, "src", "app", "api");

function walk(directory, out = []) {
  for (const entry of readdirSync(directory)) {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) walk(entryPath, out);
    else if (entry === "route.js") out.push(entryPath);
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

for (const file of files) {
  const src = readFileSync(file, "utf-8");
  const relativePath = relative(ROOT, file);
  const entry = { file: relativePath, roleGates: [], requireAuthRoles: [], capabilityGates: [], sessionRoleChecks: 0, assignmentGates: 0 };

  for (const match of src.matchAll(roleListRe)) {
    const roleList = match[1].split(",").map((roleToken) => roleToken.trim().replace(/["']/g, "")).filter(Boolean).join(",");
    entry.roleGates.push(roleList);
    roleSets.set(roleList, (roleSets.get(roleList) || 0) + 1);
  }
  if (entry.roleGates.length) { tally.filesWithRoleGate++; tally.roleGateCount += entry.roleGates.length; }

  for (const match of src.matchAll(requireAuthRe)) {
    entry.requireAuthRoles.push(match[1].split(",").map((roleToken) => roleToken.trim().replace(/["']/g, "")).filter(Boolean).join(","));
  }
  if (entry.requireAuthRoles.length) { tally.filesWithRequireAuthRoles++; tally.requireAuthRolesCount += entry.requireAuthRoles.length; }

  for (const match of src.matchAll(requireAuthorizationRe)) {
    entry.capabilityGates.push(`${match[1]}.${match[2]}`);
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
for (const [roleList, count] of [...roleSets.entries()].sort((left, right) => right[1] - left[1])) {
  console.log(`  [${roleList}] × ${count}`);
}

console.log(`\n— Files with legacy role gates (createHandler roles / requireAuth([roles]) / session.role) —`);
for (const fileEntry of perFile.sort((left, right) => right.roleGates.length + right.requireAuthRoles.length - (left.roleGates.length + left.requireAuthRoles.length))) {
  const bits = [];
  if (fileEntry.roleGates.length) bits.push(`roles=[${fileEntry.roleGates.join(" | ")}]`);
  if (fileEntry.requireAuthRoles.length) bits.push(`requireAuth([${fileEntry.requireAuthRoles.join(" | ")}])`);
  if (fileEntry.sessionRoleChecks) bits.push(`${fileEntry.sessionRoleChecks}×session.role`);
  if (fileEntry.assignmentGates) bits.push(`${fileEntry.assignmentGates}×assignment-gate`);
  console.log(`  ${fileEntry.file} — ${bits.join("; ")}`);
}

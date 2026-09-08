/**
 * Role-resolution tests.
 * Run: node scripts/test-roles.mjs
 */

import { DEFAULT_ROLE, isPrivilegedRole, resolveDefaultRole } from "../src/lib/platform/roles.js";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log("\nDefault role");
check("default is participant", DEFAULT_ROLE === "participant");

console.log("\nresolveDefaultRole");
check("no role → participant", resolveDefaultRole(null) === "participant");
check("empty role → participant", resolveDefaultRole("") === "participant");
check("no program fallback is NOT staff", resolveDefaultRole(undefined) !== "staff");
check("explicit staff preserved", resolveDefaultRole("staff") === "staff");
check("explicit program_manager preserved", resolveDefaultRole("program_manager") === "program_manager");
check("explicit teacher preserved", resolveDefaultRole("teacher") === "teacher");
check("explicit admin preserved", resolveDefaultRole("admin") === "admin");
check("explicit participant preserved", resolveDefaultRole("participant") === "participant");
check("unknown role → participant", resolveDefaultRole("something_else") === "participant");

console.log("\nisPrivilegedRole");
check("staff privileged", isPrivilegedRole("staff"));
check("participant not privileged", !isPrivilegedRole("participant"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

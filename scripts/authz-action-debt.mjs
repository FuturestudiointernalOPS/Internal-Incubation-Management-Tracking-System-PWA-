/**
 * Regenerate the frozen action debt (Lot 4, step 4.1).
 *
 * Usage:
 *   node scripts/authz-action-debt.mjs           # print the count only
 *   node scripts/authz-action-debt.mjs --write   # rewrite the module
 *
 * The classification is the SAME one the metrics use (`a_proteger` and
 * `a_verifier_decision_deleguee` = no capability declaration). Reusing it means
 * the registry and the dashboard can never disagree about what is undeclared.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { collectMetrics } = require("./lib/authzMetrics.js");
const {
  DELEGATED_DECISIONS,
} = require("../src/services/authorization/actionDeclarations.js");

const TARGET = "src/services/authorization/actionDebt.js";
const write = process.argv.includes("--write");

// A delegated decision is DECLARED (the registry names the service and the
// rule), even though the text scan cannot see it inside the route.
const delegated = new Set(DELEGATED_DECISIONS.map((entry) => entry.file));

const metrics = collectMetrics();
const undeclared = metrics.routes.withoutCapabilityList
  .filter(
    (entry) =>
      (entry.category === "a_proteger" ||
        entry.category === "a_verifier_decision_deleguee") &&
      !delegated.has(entry.file),
  )
  .sort((left, right) =>
    left.category === right.category
      ? left.file.localeCompare(right.file)
      : left.category.localeCompare(right.category),
  );

console.log(`undeclared actions: ${undeclared.length}`);

if (!write) process.exit(0);

const lines = undeclared.map(
  (entry) => `  { file: "${entry.file}", category: "${entry.category}" },`,
);

const content = `/**
 * GENERATED — the action debt (Lot 4, step 4.1).
 *
 * Every API route below is reachable with a session/role gate but NO capability
 * declaration. It is the worklist of step 4.2, frozen so it can only shrink:
 * a new route in this state fails the test, and a route that gains a
 * declaration must be removed from this list.
 *
 * Regenerate with: node scripts/authz-action-debt.mjs --write
 */

export const UNDECLARED_ACTIONS = [
${lines.join("\n")}
];
`;

const current = readFileSync(TARGET, "utf8");
writeFileSync(TARGET, content);
console.log(`written: ${TARGET}${current === content ? " (unchanged)" : ""}`);

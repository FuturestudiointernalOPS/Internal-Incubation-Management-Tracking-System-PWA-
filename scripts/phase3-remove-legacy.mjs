/**
 * Phase 3 — remove the four dead legacy capability functions from src/lib/auth.js.
 * Line-based removal (bottom-up). Verified by greps: zero callers remain.
 * Ranges: 1174-1259 getUserEffectiveCapabilitiesV2
 *         1261-1344 getUserFullPermissionMatrixV2
 *         1346-1395 hasCapabilityV2
 *         1397-1427 requireCapabilityV2
 */
import { readFileSync, writeFileSync } from "node:fs";

const p = "src/lib/auth.js";
const lines = readFileSync(p, "utf-8").split("\n");

const ranges = [
  [1174, 1259],
  [1261, 1344],
  [1346, 1395],
  [1397, 1427],
];

// Sanity check: each range must start with "/**" and end with "}"
for (const [a, b] of ranges) {
  if (!lines[a - 1].includes("/**")) throw new Error(`range ${a} does not start with /**`);
  if (!lines[b - 1].trim().startsWith("}")) throw new Error(`range ${b} does not end with }`);
}
console.log("sanity checks passed");

// Remove bottom-up so earlier line numbers stay valid.
for (const [a, b] of ranges.slice().reverse()) {
  lines.splice(a - 1, b - a + 1);
}

// Verify the removed names no longer appear as definitions.
const out = lines.join("\n");
for (const name of ["getUserEffectiveCapabilitiesV2", "getUserFullPermissionMatrixV2", "hasCapabilityV2", "requireCapabilityV2"]) {
  if (out.includes(name)) throw new Error(`${name} still present`);
}
console.log("all four legacy functions removed");

writeFileSync(p, out);
console.log("auth.js updated");

/**
 * GUARD-EXT-1 — ratchet for the five role-gate mechanisms NOT covered by the
 * M1–M4 ratchet: `const ROLE`, `ROLE_ACCESS`, `PERSONAL_ROLES`,
 * `role_capabilities`, `requireVentureAccess`.
 *
 * Every entry in the exception list is a `<path>#<motif>` pair that EXISTS
 * today (dated). The test fails when a NEW pair appears OR a listed pair
 * disappears, so the list can only be reviewed downward, never silently grown.
 *
 * CLASSIFICATION (not blind counting):
 *   - decision : mechanisms that decide ACCESS — `role_capabilities` (legacy
 *                table) and `requireVentureAccess` (venture gate).
 *   - display  : role constants / navigation masks — reviewed as NOT access
 *                decisions, but still ratcheted so a NEW one surfaces.
 *
 * Regenerate after an intentional change:
 *   node scratch/gen-role-gate-ext.mjs
 */
const fs = require("node:fs");
const path = require("node:path");
const EXCEPTIONS = require("./helpers/roleGateExceptionsExtended");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const toPosix = (p) => p.split(path.sep).join("/");
const relOf = (abs) => toPosix(path.relative(ROOT, abs));

const ENGINE_PREFIXES = [
  path.join(SRC, "server", "authz") + path.sep,
  path.join(SRC, "models", "authorization") + path.sep,
  path.join(SRC, "services", "authorization") + path.sep,
];
const EXCLUDED_PREFIXES = [path.join(SRC, "__tests__") + path.sep];

const MOTIFS = {
  M5: { re: /const\s+ROLE/, bucket: "display" },
  M6: { re: /ROLE_ACCESS/, bucket: "display" },
  M7: { re: /PERSONAL_ROLES/, bucket: "display" },
  M8: { re: /role_capabilities/, bucket: "decision" },
  M9: { re: /requireVentureAccess\(/, bucket: "decision" },
};

function walk(dir, keep) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, keep));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

function collect() {
  const decision = new Set();
  const display = new Set();
  const files = walk(SRC, (name) => name.endsWith(".js") || name.endsWith(".jsx"));
  for (const file of files) {
    if (EXCLUDED_PREFIXES.some((p) => file.startsWith(p))) continue;
    if (ENGINE_PREFIXES.some((p) => file.startsWith(p))) continue;
    const rel = relOf(file);
    const seen = new Set();
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      for (const [key, { re, bucket }] of Object.entries(MOTIFS)) {
        if (re.test(line) && !seen.has(key)) {
          seen.add(key);
          (bucket === "decision" ? decision : display).add(`${rel}#${key}`);
        }
      }
    }
  }
  return { decision, display };
}

describe("Garde étendue — mécanismes M5–M9 (GUARD-EXT-1)", () => {
  const found = collect();
  const expectedDecision = new Set(EXCEPTIONS.decision);
  const expectedDisplay = new Set(EXCEPTIONS.display);

  test("aucune nouvelle décision d'accès (M8/M9), aucune exception périmée", () => {
    const unexpected = [...found.decision].filter((p) => !expectedDecision.has(p)).sort();
    const stale = [...expectedDecision].filter((p) => !found.decision.has(p)).sort();
    expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
  });

  test("aucun nouveau masque/nom de rôle (M5/M6/M7), aucune exception périmée", () => {
    const unexpected = [...found.display].filter((p) => !expectedDisplay.has(p)).sort();
    const stale = [...expectedDisplay].filter((p) => !found.display.has(p)).sort();
    expect({ unexpected, stale }).toEqual({ unexpected: [], stale: [] });
  });
});

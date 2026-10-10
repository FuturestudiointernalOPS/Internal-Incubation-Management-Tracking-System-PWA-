/**
 * PHASE 6 — tâche 2 : garde des routes « OUVERTE_ASSUMEE ».
 *
 * Une route API sans décision de permission doit être soit PUBLIQUE (proxy),
 * soit gardée par un SECRET (tâche planifiée / webhook). Ce test énumère ces
 * routes et exige que CHACUNE soit déclarée (avec sa justification) dans
 * `helpers/openAssumedDeclaration.js` — et qu'aucune entrée ne soit périmée.
 *
 * Une route qui gagne une décision de permission sort automatiquement de cet
 * ensemble (elle n'est plus « ouverte assumée »).
 */

const fs = require("node:fs");
const path = require("node:path");
const { proxy } = require("@/proxy");
const {
  OPEN_ASSUMED_ROUTES,
  DECISION_MECHANISMS,
  SECRET_MECHANISMS,
  OPEN_ASSUMED_KINDS,
} = require("@/services/authorization/actionDeclarations");

const ROOT = path.join(__dirname, "..", "..");
const API_ROOT = path.join(ROOT, "src", "app", "api");
const toPosix = (p) => p.split(path.sep).join("/");
const relOf = (abs) => toPosix(path.relative(ROOT, abs));

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === "route.js") out.push(full);
  }
  return out;
}

const routeUrl = (file) =>
  `/api/${toPosix(path.relative(API_ROOT, file)).replace(/route\.js$/, "")}`.replace(/\/$/, "");

const declaredPublic = (url) =>
  proxy({
    nextUrl: { pathname: url },
    url: `https://app.example${url}`,
    cookies: { get: () => undefined },
  }).status === 200;

/** Every route that is open-by-design (public or secret) with no decision. */
function openAssumedRoutes() {
  const files = [];
  for (const file of walk(API_ROOT)) {
    const code = stripComments(fs.readFileSync(file, "utf8"));
    if (DECISION_MECHANISMS.some((m) => code.includes(m))) continue;
    if (code.includes("getSession(") || code.includes("requireAuth(")) continue;
    const isPublic = declaredPublic(routeUrl(file));
    const isSecret = SECRET_MECHANISMS.some((m) => code.includes(m));
    if (!isPublic && !isSecret) continue;
    files.push(relOf(file));
  }
  return files.sort();
}

describe("OUVERTE_ASSUMEE — déclarations (Phase 6, tâche 2)", () => {
  test("toute route ouverte par conception est déclarée", () => {
    const declared = new Set(OPEN_ASSUMED_ROUTES.map((entry) => entry.file));
    const undeclared = openAssumedRoutes().filter((rel) => !declared.has(rel));
    expect(undeclared).toEqual([]);
  });

  test("aucune déclaration périmée (la route n'est plus ouverte par conception)", () => {
    const open = new Set(openAssumedRoutes());
    const stale = OPEN_ASSUMED_ROUTES.map((entry) => entry.file)
      .filter((rel) => !open.has(rel))
      .sort();
    expect(stale).toEqual([]);
  });

  test("chaque déclaration porte un type connu et une justification écrite", () => {
    const kinds = new Set(OPEN_ASSUMED_KINDS);
    for (const entry of OPEN_ASSUMED_ROUTES) {
      expect(kinds.has(entry.kind)).toBe(true);
      expect(typeof entry.reason).toBe("string");
      expect(entry.reason.trim().length).toBeGreaterThan(10);
    }
  });
});

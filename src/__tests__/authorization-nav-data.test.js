/**
 * Étape 3 — the navigation capability proposal is complete, valid and inert.
 *
 * The proposal is DATA. It must not import anything, and every destination
 * that still has no declared right must carry exactly one proposal. A typo in
 * a capability name must fail here, not at menu time.
 */

const fs = require("node:fs");
const path = require("node:path");

const { MASTER_NAVIGATION } = require("@/lib/masterNavigation/nodes");
const { NAV_CAPABILITY_REQUIREMENTS } = require("@/lib/masterNavigation/access");
const {
  NAV_CAPABILITY_PROPOSAL,
  NAV_CAPABILITY_NOTES,
} = require("@/models/authorization/navData");
const { CAPABILITY_CATALOG } = require(
  "@/models/authorization/constants/feature-module-capability",
);

const ROOT = path.join(__dirname, "..", "..");
const NAV_DATA_FILE = path.join(ROOT, "src", "models", "authorization", "navData.js");

function flatten(nodes, out = []) {
  for (const node of nodes) {
    out.push(node);
    if (node.children?.length) flatten(node.children, out);
  }
  return out;
}

const nodes = flatten(MASTER_NAVIGATION);
const byId = new Map(nodes.map((node) => [node.id, node]));

function alternatives(value) {
  return String(value || "")
    .split(" OR ")
    .map((part) => part.trim())
    .filter(Boolean);
}

describe("navigation capability proposal — data only", () => {
  test("the data file is inert", () => {
    const source = fs.readFileSync(NAV_DATA_FILE, "utf8");
    const code = source
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed !== "" &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("/*")
        );
      })
      .join("\n");

    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/@\/lib\/db|db\.execute|client\.query/);
  });

  test("every undecided destination has a proposal", () => {
    const missing = nodes
      .filter((node) => !NAV_CAPABILITY_REQUIREMENTS[node.id])
      .filter((node) => !NAV_CAPABILITY_PROPOSAL[node.id])
      .map((node) => node.id);
    expect(missing).toEqual([]);
  });

  test("every proposal targets a real, still-undecided destination", () => {
    const problems = [];
    for (const id of Object.keys(NAV_CAPABILITY_PROPOSAL)) {
      if (!byId.has(id)) {
        problems.push(`destination inconnue: ${id}`);
        continue;
      }
      if (NAV_CAPABILITY_REQUIREMENTS[id]) {
        problems.push(`proposition périmée (droit déjà déclaré): ${id}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every proposed capability exists in the catalogue", () => {
    const problems = [];
    for (const [id, value] of Object.entries(NAV_CAPABILITY_PROPOSAL)) {
      if (value === "public") continue;
      for (const alternative of alternatives(value)) {
        const index = alternative.indexOf(".");
        if (index < 0) {
          problems.push(`${id}: format invalide (${alternative})`);
          continue;
        }
        const moduleKey = alternative.slice(0, index);
        const capability = alternative.slice(index + 1);
        const definition = CAPABILITY_CATALOG[moduleKey];
        if (!definition) {
          problems.push(`${id}: module inconnu (${moduleKey})`);
          continue;
        }
        if (!definition.capabilities?.[capability]) {
          problems.push(`${id}: capacité inconnue (${moduleKey}.${capability})`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every note belongs to a proposed destination", () => {
    const orphans = Object.keys(NAV_CAPABILITY_NOTES).filter(
      (id) => !NAV_CAPABILITY_PROPOSAL[id],
    );
    expect(orphans).toEqual([]);
  });
});

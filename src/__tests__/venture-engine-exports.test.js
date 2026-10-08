/**
 * The engine's exports and its importers must not drift.
 *
 * A rename that misses one route is invisible to jest until that route runs —
 * the milestones reorder route carried a stale `releaseFirstMilestoneForStage`
 * import exactly like that. This pins the contract: every name imported from
 * ventureMilestoneEngine anywhere in src/ must exist on the module, so a
 * rename fails HERE instead of at runtime.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const engine = require("@/services/ventures/milestoneEngine");
const exported = new Set(Object.keys(engine));

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe("ventureMilestoneEngine — importers only use names the module exports", () => {
  test("every imported name exists", () => {
    const missing = [];
    for (const file of walk(path.join(ROOT, "src"))) {
      if (file.includes("__tests__")) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const line of source.split(/\r?\n/)) {
        if (!line.includes("milestoneEngine")) continue;
        const named = line.match(/\{([^}]*)\}/);
        if (!named) continue;
        for (const raw of named[1].split(",")) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (name && !exported.has(name)) missing.push(`${path.relative(ROOT, file)} → ${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

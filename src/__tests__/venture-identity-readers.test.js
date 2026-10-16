/**
 * Guard — no model joins `ventures` on the decorative code (Vinance Phase 0,
 * step 4).
 *
 * Once the storage is unified (every reference holds `ventures.id`), a join to
 * `ventures` on `v.venture_id` silently returns nothing — the two `OR` bridges
 * and the code-based joins are exactly the classes of bug that hid the drift in
 * the first place. This test pins their removal so they cannot come back:
 *
 *   SELECT ... FROM venture_members vm JOIN ventures v ON v.venture_id = vm.venture_id
 *   SELECT ... WHERE (v.venture_id = ? OR v.id::text = ?)      -- the OR bridge
 *
 * Reading the CODE is fine (it is the access key): `SELECT v.venture_id`, and
 * `WHERE v.venture_id = ?` (a lookup on the Venture itself) both still appear
 * and are not flagged here. What is forbidden is comparing a CHILD reference to
 * `v.venture_id`.
 */

const fs = require("node:fs");
const path = require("node:path");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const MODEL_FILES = walk(path.join(process.cwd(), "src", "models"));

const FORBIDDEN = [
  // `v.venture_id = vm.venture_id` — the Venture joined on the code.
  { name: "join on v.venture_id (code on the right)", re: /\bv\.venture_id\s*=\s*\w+\.venture_id\b/ },
  // `vm.venture_id = v.venture_id` — the same, written the other way round.
  { name: "join on v.venture_id (code on the left)", re: /\b\w+\.venture_id\s*=\s*v\.venture_id\b/ },
  // `OR t.venture_id::text = v.venture_id` — the transitional bridge.
  { name: "the OR bridge", re: /\bOR\s+\w+\.venture_id::text\s*=\s*v\.venture_id\b/i },
];

describe("venture identity — the model layer joins on the internal id", () => {
  test("every model file is scanned", () => {
    expect(MODEL_FILES.length).toBeGreaterThan(50);
  });

  test.each(FORBIDDEN)("no model carries $name", ({ re }) => {
    const offenders = MODEL_FILES.filter((file) => re.test(fs.readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });
});

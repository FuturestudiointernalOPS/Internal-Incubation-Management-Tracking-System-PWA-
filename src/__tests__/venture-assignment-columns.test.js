/**
 * REGRESSION PIN — an assignment has TWO halves, on every table that carries one.
 *
 * `assigned_cid` / `owner_cid` is the identity (nullable: a person on a plan need
 * not have an account). `assigned_name` / `owner_name` is the name the tracker
 * wrote. Code that writes the identity half almost always writes the name half
 * too — so a table that has one without the other is a table that will fail at
 * the write, on the environment that never received the column.
 *
 * That is exactly what happened: `venture_deliverables` had `assigned_cid` but no
 * `assigned_name`, no migration created it, and applying an imported plan died on
 * `column "assigned_name" of relation "venture_deliverables" does not exist`.
 * Staging had been given the column by hand, so nothing caught it.
 *
 * The pin: for every identity column the schema self-heal knows about, the name
 * column must be stated in the SAME list — because that list is the only thing
 * that makes an environment converge.
 */

const fs = require("node:fs");
const path = require("node:path");

// The schema self-heal is split into parts under `services/ventures/schema/`;
// the pin reads the whole set, so a statement moving between parts is not a failure.
const SCHEMA_DIR = path.join(__dirname, "..", "services", "ventures", "schema");
const SCHEMA_SOURCE = fs
  .readdirSync(SCHEMA_DIR)
  .filter((file) => file.endsWith(".js"))
  .sort()
  .map((file) => fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8"))
  .join("\n");

/** table -> [identity column, name column] */
const ASSIGNMENT_TABLES = {
  venture_tasks: ["assigned_cid", "assigned_name"],
  venture_deliverables: ["assigned_cid", "assigned_name"],
  venture_milestones: ["owner_cid", "owner_name"],
};

describe("every assignment table states BOTH halves in the schema self-heal", () => {
  for (const [table, [identity, name]] of Object.entries(ASSIGNMENT_TABLES)) {
    test(`${table}: ${identity} and ${name} are both created`, () => {
      expect(SCHEMA_SOURCE).toContain(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${identity} `,
      );
      expect(SCHEMA_SOURCE).toContain(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} `,
      );
    });
  }
});

describe("the writers agree with the self-heal", () => {
  test("the plan import writes the name half to deliverables and tasks", () => {
    const importer = fs.readFileSync(
      path.join(__dirname, "..", "models", "venturePlanImportStore.js"),
      "utf8",
    );
    // Both inserts name the column they depend on, so a missing one is a loud
    // 500 at apply rather than a silently dropped assignment.
    expect(importer).toMatch(/INSERT INTO venture_tasks[\s\S]*?assigned_name/);
    expect(importer).toMatch(/INSERT INTO venture_deliverables[\s\S]*?assigned_name/);
  });

  test("the operational-context columns are created AND written", () => {
    // The schema self-heal states them…
    expect(SCHEMA_SOURCE).toContain("ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS definition_of_done ");
    expect(SCHEMA_SOURCE).toContain("ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS support_name ");
    expect(SCHEMA_SOURCE).toContain("ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS support_name ");
    expect(SCHEMA_SOURCE).toContain("ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS task_id ");
    // …and the plan import writes them, so the Definition of Done and the
    // Activity → Deliverable link survive an import instead of a folded label.
    const importer = fs.readFileSync(
      path.join(__dirname, "..", "models", "venturePlanImportStore.js"),
      "utf8",
    );
    expect(importer).toMatch(/INSERT INTO venture_tasks[\s\S]*?definition_of_done/);
    expect(importer).toMatch(/INSERT INTO venture_tasks[\s\S]*?support_name/);
    expect(importer).toMatch(/INSERT INTO venture_deliverables[\s\S]*?task_id/);
  });
});

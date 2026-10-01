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

const SCHEMA_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "lib", "ventures.js"),
  "utf8",
);

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
      path.join(__dirname, "..", "models", "venturePlanImport.js"),
      "utf8",
    );
    // Both inserts name the column they depend on, so a missing one is a loud
    // 500 at apply rather than a silently dropped assignment.
    expect(importer).toMatch(/INSERT INTO venture_tasks[\s\S]*?assigned_name/);
    expect(importer).toMatch(/INSERT INTO venture_deliverables[\s\S]*?assigned_name/);
  });
});

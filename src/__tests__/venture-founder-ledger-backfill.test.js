/**
 * THE FOUNDER LEDGER BACKFILL — what it records, and what it refuses to touch.
 *
 * Ventures created before creation started writing the founder ledger have
 * their founders only in the membership list, so their founder screen reads
 * "no founders" for a Venture that has one. The backfill records those missing
 * rows once, and must be safe to run again on a live database.
 */

const { reconcileFounderLedger } = require("@/models/ventureFounderLedger");

const FOUNDER_ROWS = {
  "VNT-A": [
    { contact_id: "USR_1", user_cid: "USR_1", member_type: "founder", role: "founder", lead_founder: true, is_owner: true, name: "Ada Lead", email: "ada@x.io" },
    { contact_id: "USR_2", user_cid: "USR_2", member_type: "founder", role: "co-founder", lead_founder: false, is_owner: false, name: "Bo Two", email: "bo@x.io" },
    { contact_id: "USR_3", user_cid: "USR_3", member_type: "founder", role: "founder", lead_founder: false, is_owner: false, name: null, email: null },
  ],
  "VNT-B": [
    // Already recorded before the run — nothing to add for this Venture.
    { contact_id: "USR_9", user_cid: "USR_9", member_type: "founder", role: "founder", lead_founder: true, is_owner: true, name: "Cy Three", email: "cy@x.io" },
  ],
};

function fakeDb() {
  const execute = jest.fn(async ({ sql, args = [] }) => {
    const text = String(sql);
    if (/SELECT DISTINCT vm\.venture_id/.test(text)) {
      return { rows: Object.keys(FOUNDER_ROWS).map((venture_id) => ({ venture_id })) };
    }
    if (/FROM venture_members vm/.test(text)) {
      return { rows: FOUNDER_ROWS[args[0]] || [] };
    }
    if (/SELECT id FROM venture_founders/.test(text)) {
      return { rows: args[0] === "VNT-B" ? [{ id: 9 }] : [] };
    }
    return { rows: [] };
  });
  return { execute };
}

const writes = (db) => db.execute.mock.calls.filter(([c]) => String(c.sql).includes("INSERT INTO venture_founders"));

describe("founder ledger backfill", () => {
  test("a dry run reports exactly what it would write and writes nothing", async () => {
    const db = fakeDb();
    const report = await reconcileFounderLedger(db, { dryRun: true });

    expect(report).toMatchObject({
      dry_run: true,
      ventures: 2,
      examined: 4,
      added: 2,
      already_recorded: 1,
      without_email: 1,
    });
    expect(report.added_rows).toEqual([
      { venture_id: "VNT-A", email: "ada@x.io", name: "Ada Lead", role: "founder" },
      { venture_id: "VNT-A", email: "bo@x.io", name: "Bo Two", role: "co-founder" },
    ]);
    expect(writes(db)).toHaveLength(0);
  });

  test("applying records the missing founders as accepted, owner flagged", async () => {
    const db = fakeDb();
    const report = await reconcileFounderLedger(db, { dryRun: false });
    expect(report.added).toBe(2);

    const rows = writes(db).map(([c]) => c);
    expect(rows).toHaveLength(2);

    const [owner, coFounder] = rows;
    expect(owner.sql).toContain("'accepted'");
    expect(owner.sql).toContain("WHERE NOT EXISTS"); // idempotent, matched by email
    expect(owner.args[0]).toBe("VNT-A");
    expect(owner.args[2]).toBe("ada@x.io");
    expect(owner.args[4]).toBe("founder"); // role
    expect(owner.args[5]).toBe(true); // is_owner

    expect(coFounder.args[2]).toBe("bo@x.io");
    expect(coFounder.args[4]).toBe("co-founder");
    expect(coFounder.args[5]).toBe(false);
  });

  test("only Ventures that actually have a founder are examined", () => {
    const src = require("fs").readFileSync(
      require("path").join(process.cwd(), "src/models/ventureFounderLedger.js"),
      "utf8",
    );
    // The Venture list is filtered to real founder memberships, so a Venture with
    // nobody in it is reported as nothing rather than as a gap.
    expect(src).toContain("SELECT DISTINCT vm.venture_id");
    expect(src).toContain("vm.member_type = 'founder' OR vm.lead_founder = TRUE OR vm.is_owner = TRUE");
    // Never an update or a delete: a backfill only adds what is missing.
    expect(src).not.toContain("UPDATE venture_founders");
    expect(src).not.toContain("DELETE FROM venture_founders");
  });

  test("the runner is a dry run unless --apply is passed", () => {
    const script = require("fs").readFileSync(
      require("path").join(process.cwd(), "scripts/backfill-founder-ledger.mjs"),
      "utf8",
    );
    expect(script).toContain('process.argv.includes("--apply")');
    expect(script).toContain("dryRun: !APPLY");
  });
});

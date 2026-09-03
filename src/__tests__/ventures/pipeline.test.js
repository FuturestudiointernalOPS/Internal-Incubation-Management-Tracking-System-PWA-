/**
 * Venture pipeline (Phase 2) — unit tests for createVentureFromSubmission
 *
 * The single official Venture creation path: an approved Venture Application
 * submission creates the Venture + provenance + members + history.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(),
  },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventures", () => ({
  ensureVentureSchema: jest.fn().mockResolvedValue(true),
  generateVentureId: jest.fn(() => "VNT-TEST1234"),
  createVentureNotification: jest.fn().mockResolvedValue(true),
  resolveTeamMembersForPromotion: jest.fn().mockResolvedValue([]),
}));

const db = require("@/lib/db").default;
const { createVentureFromSubmission } = require("@/lib/venturePipeline");

const SUBMISSION = {
  id: 42,
  run_id: 7,
  submitter_id: "USR_FOUNDER",
  invitation_id: 9,
  data: {
    1: "ABC Technologies",
    2: "SaaS",
    3: "idea",
    4: "https://abc.tech",
    5: "mary@cofounder.io",
    6: "sarah@team.io",
    7: "John Doe",
    8: "john@example.com",
  },
};

const RUN = { id: 7, name: "Venture Application", form_id: 3 };
const FORM = { id: 3, settings: { venture_application: true } };
const REVIEW = { decision: "approved", reviewer_name: "PM One" };

const FIELD_ROWS = [
  { id: 1, settings: { key: "company_name" } },
  { id: 2, settings: { key: "industry" } },
  { id: 3, settings: { key: "business_stage" } },
  { id: 4, settings: { key: "website" } },
  { id: 5, settings: { key: "co_founder_emails" } },
  { id: 6, settings: { key: "team_member_emails" } },
  { id: 7, settings: { key: "founder_name" } },
  { id: 8, settings: { key: "founder_email" } },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Reset queued one-time responses from any previous (possibly failed) test,
  // then provide a safe empty-result default for un-queued calls.
  db.execute.mockReset();
  db.execute.mockImplementation(async () => ({ rows: [] }));
});

describe("createVentureFromSubmission", () => {
  it("skips when a Venture already exists for the submission (idempotent)", async () => {
    db.execute.mockResolvedValueOnce({ rows: [{ venture_id: "VNT-EXISTS" }] }); // origins lookup

    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    expect(result).toEqual({ skipped: true, reason: "already created", venture_id: "VNT-EXISTS" });
    // No inserts beyond the idempotency check
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it("skips when the company name already exists", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // origins lookup
      .mockResolvedValueOnce({ rows: FIELD_ROWS }) // fields (key-mapped)
      .mockResolvedValueOnce({ rows: [{ venture_id: "VNT-DUP" }] }); // duplicate company

    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    expect(result).toEqual({ skipped: true, reason: "duplicate company name", venture_id: "VNT-DUP" });
  });

  it("skips when the submission has no identifiable company name — never names the Venture after the run", async () => {
    // Default mock returns empty rows: no key-mapped fields and no field
    // labels, so no company name can be derived from the submission.
    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("missing_company_name");
  });

  it("creates the Venture, provenance, founder and members, and notifies", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // 1. origins lookup
      .mockResolvedValueOnce({ rows: FIELD_ROWS }) // 2. fields
      .mockResolvedValueOnce({ rows: [] }) // 3. duplicate company
      .mockResolvedValueOnce({ rows: [{ target_type: "program", target_id: "P1" }] }) // 4. assignments
      .mockResolvedValueOnce({ rows: [] }) // 5. invitation lookup (none)
      .mockResolvedValueOnce({ rows: [] }) // 6. venture insert
      .mockResolvedValueOnce({ rows: [] }) // 7. origins insert
      .mockResolvedValueOnce({ rows: [] }) // 8. founder member insert
      .mockResolvedValueOnce({ rows: [] }) // 9. contact role update
      .mockResolvedValueOnce({ rows: [] }) // 10a. co-founder contact select (no existing)
      .mockResolvedValueOnce({ rows: [] }) // 10b. co-founder contact insert
      .mockResolvedValueOnce({ rows: [] }) // 10c. co-founder member insert
      .mockResolvedValueOnce({ rows: [] }) // 10d. team contact select (no existing)
      .mockResolvedValueOnce({ rows: [] }) // 10e. team contact insert
      .mockResolvedValueOnce({ rows: [] }) // 10f. team member insert
      .mockResolvedValueOnce({ rows: [] }) // 11a. history
      .mockResolvedValueOnce({ rows: [] }); // 11b. activity

    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    expect(result).toEqual({ success: true, venture_id: "VNT-TEST1234", source_type: "participant" });

    // Venture insert with the mapped data
    const ventureInsert = db.execute.mock.calls.find(([c]) => c.sql.includes("INSERT INTO ventures"));
    expect(ventureInsert).toBeDefined();
    const args = ventureInsert[0].args;
    expect(args[0]).toBe("VNT-TEST1234");
    expect(args[1]).toBe("ABC Technologies");
    expect(args[2]).toBe("ABC Technologies"); // name + company_name
    expect(args[3]).toBe("SaaS"); // industry
    expect(args[4]).toBe("idea"); // business_stage
    expect(args[11]).toBe("P1"); // program_id from run assignment

    // Provenance row
    const originsInsert = db.execute.mock.calls.find(([c]) => c.sql.includes("INSERT INTO venture_origins"));
    expect(originsInsert).toBeDefined();
    expect(originsInsert[0].args).toContain("participant");
    expect(originsInsert[0].args).toContain(42); // submission_id

    // Founder member: submitter is lead founder + owner (roles are SQL literals)
    const memberInserts = db.execute.mock.calls.filter(([c]) => c.sql.includes("INSERT INTO venture_members"));
    expect(memberInserts.length).toBe(3);
    const founderInsert = memberInserts[0];
    expect(founderInsert[0].args.slice(0, 3)).toEqual(["VNT-TEST1234", "USR_FOUNDER", "USR_FOUNDER"]);
    expect(founderInsert[0].sql).toContain("'founder', 'founder', 'edit', ?, TRUE, TRUE");

    // Co-founder role mapping (values passed as args)
    const coFounderInsert = memberInserts[1][0].args;
    expect(coFounderInsert[3]).toBe("founder"); // member_type
    expect(coFounderInsert[4]).toBe("co-founder"); // role
    const teamInsert = memberInserts[2][0].args;
    expect(teamInsert[3]).toBe("team_member"); // member_type
    expect(teamInsert[4]).toBe("member"); // role

    // Notifications fired for submitter + sa
    const { createVentureNotification } = require("@/lib/ventures");
    expect(createVentureNotification).toHaveBeenCalledTimes(2);
  });

  it("carries team members over when the submission came from a team invitation", async () => {
    const { resolveTeamMembersForPromotion } = require("@/lib/ventures");
    resolveTeamMembersForPromotion.mockResolvedValue([
      { contact_id: "USR_TEAM", name: "Team Mate", email: "mate@team.io" },
      { contact_id: "USR_FOUNDER", name: "John Doe", email: "john@example.com" }, // submitter — skipped
    ]);

    db.execute
      .mockResolvedValueOnce({ rows: [] }) // 1. origins lookup
      .mockResolvedValueOnce({ rows: FIELD_ROWS }) // 2. fields
      .mockResolvedValueOnce({ rows: [] }) // 3. duplicate company
      .mockResolvedValueOnce({ rows: [] }) // 4. assignments (empty — invitation drives)
      .mockResolvedValueOnce({ rows: [{ id: 5, source_type: "team", program_id: "P1", team_id: "T1" }] }) // 5. invitation
      .mockResolvedValueOnce({ rows: [] }) // 6. venture insert
      .mockResolvedValueOnce({ rows: [] }) // 7. origins insert
      .mockResolvedValueOnce({ rows: [] }) // 8. founder member insert
      .mockResolvedValueOnce({ rows: [] }) // 9. contact role update
      .mockResolvedValueOnce({ rows: [] }) // 10a. co-founder contact select
      .mockResolvedValueOnce({ rows: [] }) // 10b. co-founder contact insert
      .mockResolvedValueOnce({ rows: [] }) // 10c. co-founder member insert
      .mockResolvedValueOnce({ rows: [] }) // 10d. team contact select
      .mockResolvedValueOnce({ rows: [] }) // 10e. team contact insert
      .mockResolvedValueOnce({ rows: [] }) // 10f. team member insert
      .mockResolvedValueOnce({ rows: [] }) // 10g. team carry-over member insert
      .mockResolvedValueOnce({ rows: [] }) // 11a. history
      .mockResolvedValueOnce({ rows: [] }); // 11b. activity

    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    expect(result).toEqual({ success: true, venture_id: "VNT-TEST1234", source_type: "team" });

    // Provenance carries the team + program from the invitation
    const originsInsert = db.execute.mock.calls.find(([c]) => c.sql.includes("INSERT INTO venture_origins"));
    expect(originsInsert[0].args[1]).toBe("team");
    expect(originsInsert[0].args).toContain("P1");
    expect(originsInsert[0].args).toContain("T1");
    expect(originsInsert[0].args[9]).toBe(9); // invitation_id from the submission

    // Team member carried over as team_member; submitter not duplicated
    const memberInserts = db.execute.mock.calls.filter(([c]) => c.sql.includes("INSERT INTO venture_members"));
    expect(memberInserts.length).toBe(4); // founder + co-founder + form team + carry-over
    const carryOverInsert = memberInserts[3][0];
    expect(carryOverInsert.args[0]).toBe("VNT-TEST1234");
    expect(carryOverInsert.args[2]).toBe("USR_TEAM");
    expect(carryOverInsert.sql).toContain("'team_member', 'member', 'edit', ?, FALSE, FALSE");
    expect(resolveTeamMembersForPromotion).toHaveBeenCalledWith("T1");
  });
});

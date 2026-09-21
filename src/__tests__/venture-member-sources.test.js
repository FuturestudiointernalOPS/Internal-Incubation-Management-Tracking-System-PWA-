/**
 * THE VENTURE'S PEOPLE — one source per question.
 *
 * The defect this locks out: a Venture visibly had a founder while its founder
 * list said "none" and its team widget said "0 members", because two different
 * tables were being counted as if they answered the same question.
 *
 *   - the MEMBERSHIP table   → who is in this Venture (the founder included)
 *   - the FOUNDER ledger     → founder records / invitations (a name + email
 *                              + invited/accepted), managed on its own screen
 *
 * So:
 *   1. counting the Venture's people may read the membership list ONLY;
 *   2. creation must record the founder in the ledger too (not just membership);
 *   3. the activity journal must read in words, never as a raw payload.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/ventures", () => ({
  ensureVentureSchema: jest.fn().mockResolvedValue(true),
  generateVentureId: jest.fn(() => "VNT-TEST1234"),
  createVentureNotification: jest.fn().mockResolvedValue(true),
  resolveTeamMembersForPromotion: jest.fn().mockResolvedValue([]),
}));

const fs = require("fs");
const path = require("path");

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const db = require("@/lib/db").default;
const { createVentureFromSubmission } = require("@/lib/venturePipeline");

const PIPELINE = "src/models/venturePipeline.js";
const DASHBOARD_ROUTE = "src/app/api/ventures/[id]/dashboard/route.js";
const DASHBOARD_UI = "src/components/ventures/VentureDashboard.js";
const DETAIL_PAGE = "src/app/admin/ventures/[id]/page.js";
const MEMBERS_MODEL = "src/models/ventureMembers.js";

const SUBMISSION = {
  id: 42,
  run_id: 7,
  submitter_id: "USR_FOUNDER",
  invitation_id: 9,
  data: {
    1: "ABC Technologies",
    2: "SaaS",
    3: "idea",
    5: "mary@cofounder.io",
    6: "sarah@team.io",
    7: "John Doe",
    8: "john@example.com",
  },
};

const RUN = { id: 7, name: "Venture Application", form_id: 3 };
const FORM = { id: 3, settings: { venture_application: true } };
const REVIEW = { decision: "approved", reviewer_name: "USR_REVIEWER" };

const FIELD_ROWS = [
  { id: 1, settings: { key: "company_name" } },
  { id: 2, settings: { key: "industry" } },
  { id: 3, settings: { key: "business_stage" } },
  { id: 5, settings: { key: "co_founder_emails" } },
  { id: 6, settings: { key: "team_member_emails" } },
  { id: 7, settings: { key: "founder_name" } },
  { id: 8, settings: { key: "founder_email" } },
];

beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockReset();
  db.execute.mockImplementation(async () => ({ rows: [] }));
});

describe("creation keeps the founder ledger in step with the membership", () => {
  test("the submitter is recorded as an ACCEPTED founder, once per email", async () => {
    db.execute
      .mockResolvedValueOnce({ rows: [] }) // origins
      .mockResolvedValueOnce({ rows: FIELD_ROWS }) // fields
      .mockResolvedValueOnce({ rows: [] }) // duplicate company
      .mockResolvedValueOnce({ rows: [] }); // assignments

    const result = await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });
    expect(result.success).toBe(true);

    const ledgerInserts = db.execute.mock.calls.filter(([c]) => c.sql.includes("INSERT INTO venture_founders"));
    // founder + the co-founder named in the form (the plain team member is not a founder)
    expect(ledgerInserts).toHaveLength(2);

    const [founderRow] = ledgerInserts[0];
    expect(founderRow.sql).toContain("WHERE NOT EXISTS"); // idempotent, read by email
    expect(founderRow.sql).toContain("'accepted'");
    expect(founderRow.args[0]).toBe("VNT-TEST1234"); // venture
    expect(founderRow.args[2]).toBe("john@example.com"); // email
    expect(founderRow.args[3]).toBe("John Doe"); // name
    expect(founderRow.args[4]).toBe("founder"); // role
    expect(founderRow.args[5]).toBe(true); // is_owner

    // The co-founder is recorded too — a founder list that omitted them would be
    // just as wrong as one that omitted the submitter.
    expect(ledgerInserts[1][0].args[2]).toBe("mary@cofounder.io");
    expect(ledgerInserts[1][0].args[4]).toBe("co-founder");

    // A plain team member never becomes a founder record.
    const ledgerEmails = ledgerInserts.map(([c]) => c.args[2]);
    expect(ledgerEmails).not.toContain("sarah@team.io");
  });

  test("a reviewer identified only by user id is written down as a person", async () => {
    db.execute.mockImplementation(async ({ sql, args }) => {
      if (String(sql).includes("SELECT name, email FROM contacts WHERE cid")) {
        return args?.[0] === "USR_REVIEWER" ? { rows: [{ name: "Rémi Reviewer", email: "remi@fs.io" }] } : { rows: [] };
      }
      if (String(sql).includes("SELECT id, label, field_type, settings")) return { rows: FIELD_ROWS };
      return { rows: [] };
    });

    await createVentureFromSubmission({ submission: SUBMISSION, run: RUN, form: FORM, review: REVIEW });

    const approval = db.execute.mock.calls.find(([c]) => c.sql.includes("'VENTURE_APPROVED'"));
    expect(approval).toBeDefined();
    expect(approval[0].args[2]).toBe("Rémi Reviewer"); // a name, never "USR_…"
    expect(approval[0].args[1]).toBe("USR_REVIEWER"); // the id stays on the id column
  });
});

describe("counts read the membership list, never the founder ledger", () => {
  test("the members model reads the membership table and flags the founder", () => {
    const src = read(MEMBERS_MODEL);
    expect(src).toContain("FROM venture_members");
    expect(src).not.toContain("FROM venture_founders");
    // Founder = the founder relation, whether it arrived as a type or as a flag.
    expect(src).toContain("memberType === \"founder\"");
    expect(src).toContain("isOwner || isLead");
  });

  test("the dashboard's team widget is fed by the membership list", () => {
    const src = read(DASHBOARD_ROUTE);
    expect(src).toContain("listVentureMembers");
    expect(src).toContain("summarizeVentureMembers");
    // The founder ledger must not be what a head count is read from.
    expect(src).not.toContain("listFounders");
    expect(src).toContain("team: teamResult");
  });

  test("the widget and the detail page read that payload, not a founder list", () => {
    const widget = read(DASHBOARD_UI);
    expect(widget).toContain("d.team?.active");
    expect(widget).not.toContain("d.founders?");
    expect(widget).toContain("d.team?.founders");

    const page = read(DETAIL_PAGE);
    expect(page).toContain("member_summary");
    expect(page).toContain("memberSummary.founders");
    // The old founder-ledger head count on this page.
    expect(page).not.toContain('(venture.founders || []).length');
  });

  test("the team screen shows each member, the founder included", () => {
    const page = read(DETAIL_PAGE);
    expect(page).toContain("vadmin.detail.memberList");
    expect(page).toContain("member.is_owner");
    expect(page).toContain("member.email");
    expect(page).toContain("member.joined_at");
    expect(page).toContain("vadmin.detail.memberSince");
  });

  test("the founder screen says it lists founder records, not members", () => {
    const en = require("@/locales/en/vadmin.json").vadmin.founders;
    const fr = require("@/locales/fr/vadmin.json").vadmin.founders;
    expect(en.memberCount).toBe("{count} founders");
    expect(fr.memberCount).toBe("{count} fondateurs");
    expect(en.ledgerHint).toBeTruthy();
    expect(fr.ledgerHint).toBeTruthy();
  });
});

describe("the activity journal reads in words", () => {
  test("a change event names its fields instead of dumping a payload", () => {
    const { activityDetails, activityLabel } = require("@/lib/ventureActivity");
    const t = (key, params = {}) => {
      const table = require("@/locales/en/vadmin.json");
      const value = key.split(".").reduce((acc, part) => acc?.[part], table) ?? key;
      return String(value).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
    };

    expect(activityLabel("VENTURE_UPDATED", t)).toBe("Venture information updated");
    expect(activityDetails({ updated_fields: ["company_name", "industry"] }, t)).toEqual([
      "Fields changed: Company name, Industry",
    ]);
    expect(activityDetails({ submission_id: 2 }, t)).toEqual(["Application #2"]);
    // An unknown code still reads, and plumbing keys are dropped.
    expect(activityLabel("LEAD_CHANGED", t)).toBe("Lead founder changed");
    expect(activityDetails("{\"message\":\"Venture approved by super admin\"}", t)).toEqual([
      "Venture approved by super admin",
    ]);
    expect(activityDetails({ form_id: 3, run_id: 7 }, t)).toEqual([]);
  });

  test("no surface prints the raw payload, and none shows a raw event code", () => {
    for (const file of [DETAIL_PAGE, DASHBOARD_UI]) {
      const src = read(file);
      expect(src).toContain("@/lib/ventureActivity");
      expect(src).not.toContain("JSON.stringify(act.details)");
      expect(src).not.toContain("act.action?.replace(/_/g, \" \")");
      expect(src).not.toContain("{act.action}");
    }
  });

  test("the pipeline stores a person, not an id, as the actor name", () => {
    const src = read(PIPELINE);
    expect(src).toContain("reviewerLooksLikeId");
    expect(src).toContain("SELECT name, email FROM contacts WHERE cid");
  });
});

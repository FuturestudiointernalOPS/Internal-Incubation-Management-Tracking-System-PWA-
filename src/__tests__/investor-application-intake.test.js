/**
 * INVESTOR APPLICATION INTAKE
 *
 * The investor intake is a platform form (Investor Application) with a single
 * active run whose public link is shared by a super admin. Approval of a
 * submission provisions the investor account (profile + preferences) and sends
 * the activation email through the existing platform automation.
 *
 * Two contracts are locked here:
 *   1. STATIC — the wiring that makes that flow true (seed gate, single-active
 *      form guard, form-scoped automation call, super-admin-only link button,
 *      retired legacy questionnaire).
 *   2. BEHAVIOURAL — provisionInvestorFromApproval maps answers, creates the
 *      profile ONCE, stores preferences, and only touches the contact through
 *      the guarded investor-role writer.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/identity", () => ({
  stopRoleMutationEnabled: jest.fn(() => false),
}));

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const db = require("@/lib/db").default;
const { provisionInvestorFromApproval } = require("@/models/investorRelations");

const SEED_ROUTE = "src/app/api/platform/seed/investor-application/route.js";
const RUN_ROUTE = "src/app/api/platform/investor-run/route.js";
const FORMS_ROUTE = "src/app/api/platform/forms/route.js";
const AUTOMATION = "src/models/platform/automation.js";
const INTAKE_MODEL = "src/models/investorIntake.js";
const ADMIN_PAGE = "src/app/admin/investors/page.js";
const PROXY = "src/proxy.js";
const RETIRED_REGISTER = "src/app/api/investor/register/route.js";

beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockReset();
});

describe("static contract — the investor intake wiring", () => {
  test("the seed is super-admin only and reuses form/run idempotently", () => {
    const src = read(SEED_ROUTE);
    expect(src).toMatch(/requireAuth\(\["super_admin"\]\)/);
    expect(src).toMatch(/findInvestorApplicationFormByName/);
    expect(src).toMatch(/assertSingleInvestorForm/);
    expect(src).toMatch(/findActiveInvestorRun/);
    expect(src).toMatch(/createInvestorApplicationRun/);
    expect(src).toMatch(/investor_application: true/);
    // The approval provisions the account and sends the activation email.
    expect(src).toMatch(/create_platform_user: true/);
    expect(src).toMatch(/send_activation_email: true/);
  });

  test("the run route resolves the flagged form's single active run, super-admin only", () => {
    const src = read(RUN_ROUTE);
    expect(src).toMatch(/requireAuth\(\["super_admin"\]\)/);
    expect(src).toMatch(/resolveInvestorRun/);
  });

  test("no write path may flag a second investor form (API guard)", () => {
    const src = read(FORMS_ROUTE);
    const guardUsages = [...src.matchAll(/assertSingleInvestorForm\(/g)];
    // One guard on create, one on update.
    expect(guardUsages.length).toBe(2);
    expect(src).toMatch(/SINGLE_INVESTOR_FORM/);
  });

  test("the DB backstop is a partial unique index on the investor flag", () => {
    const src = read(INTAKE_MODEL);
    expect(src).toMatch(/idx_platform_forms_single_investor_flag/);
    expect(src).toMatch(/settings->>'investor_application' = 'true'/);
  });

  test("the automation provisions investors for the flagged form, on approval only", () => {
    const src = read(AUTOMATION);
    expect(src).toMatch(/isApproved && ctx\.form\?\.settings\?\.investor_application === true/);
    expect(src).toMatch(/provisionInvestorFromApproval/);
  });

  test("the admin link button is super-admin only and no longer points at the old wizard", () => {
    const src = read(ADMIN_PAGE);
    expect(src).toMatch(/role === "super_admin"/);
    expect(src).toMatch(/investorAdmin\.list\.addInvestor/);
    expect(src).toMatch(/platform\/seed\/investor-application/);
    // The fixed questionnaire link is gone.
    expect(src).not.toMatch(/investor\/wizard/);
  });

  test("the removed questionnaire is no longer a public path", () => {
    expect(read(PROXY)).not.toMatch(/\/investor\/wizard/);
  });

  test("the legacy register endpoint is retired explicitly (410), not a silent 404", () => {
    const src = read(RETIRED_REGISTER);
    expect(src).toMatch(/status: 410/);
    expect(src).toMatch(/LEGACY_FLOW_RETIRED/);
  });
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

const FIELD_ROWS = [
  { id: 10, settings: { key: "organization_name" } },
  { id: 11, settings: { key: "industries" } },
  { id: 12, settings: { key: "countries" } },
  { id: 13, settings: { key: "startup_stages" } },
  { id: 14, settings: { key: "ticket_size_min" } },
  { id: 15, settings: { key: "ticket_size_max" } },
  { id: 16, settings: { key: "investment_experience" } },
  { id: 17, settings: { key: "prior_investments" } },
];

const SUBMISSION = {
  id: 5,
  data: {
    10: "AfriGreen Capital",
    11: ["FinTech", "AgriTech"],
    12: ["NG", "KE"],
    13: ["Seed"],
    14: "10000",
    15: "50000",
    16: "5 years in impact investing",
    17: "3 exits",
  },
};

function installDb({ existingProfile = false } = {}) {
  db.execute.mockImplementation(async ({ sql } = {}) => {
    const text = String(sql);
    if (text.includes("FROM platform_form_fields")) return { rows: FIELD_ROWS };
    if (text.includes("SELECT id FROM investor_profiles WHERE user_id")) {
      return { rows: existingProfile ? [{ id: "prof-existing" }] : [] };
    }
    if (text.includes("INSERT INTO investor_profiles")) return { rows: [{ id: "prof-new" }] };
    if (text.includes("INSERT INTO investor_preferences")) return { rows: [] };
    if (text.includes("UPDATE investor_profiles")) return { rows: [] };
    if (text.includes("UPDATE contacts SET role")) return { rows: [] };
    return { rows: [] };
  });
}

describe("provisionInvestorFromApproval", () => {
  test("maps the answers, creates ONE approved profile and stores the preferences", async () => {
    installDb();

    const result = await provisionInvestorFromApproval({
      contactCid: "USR-INVESTOR",
      submission: SUBMISSION,
      formId: 3,
    });

    expect(result).toEqual({ success: true, profile_id: "prof-new" });

    const calls = db.execute.mock.calls.map(([c]) => c);
    const profileInsert = calls.find((c) => String(c.sql).includes("INSERT INTO investor_profiles"));
    expect(profileInsert).toBeDefined();
    expect(String(profileInsert.sql)).toContain("'approved'");
    expect(profileInsert.args[0]).toBe("USR-INVESTOR");
    expect(profileInsert.args[1]).toBe("AfriGreen Capital");

    const prefs = calls.find((c) => String(c.sql).includes("INSERT INTO investor_preferences"));
    expect(prefs).toBeDefined();
    expect(prefs.args).toEqual(["prof-new", ["FinTech", "AgriTech"], ["NG", "KE"], ["Seed"], 10000, 50000]);

    // The contact is only touched through the guarded investor-role writer.
    const roleUpdate = calls.find((c) => String(c.sql).includes("UPDATE contacts SET role = 'investor'"));
    expect(roleUpdate).toBeDefined();
    expect(String(roleUpdate.sql)).toContain("role NOT IN ('super_admin','staff','admin')");
  });

  test("reuses an existing profile instead of creating a second one", async () => {
    installDb({ existingProfile: true });

    const result = await provisionInvestorFromApproval({
      contactCid: "USR-INVESTOR",
      submission: SUBMISSION,
      formId: 3,
    });

    expect(result.profile_id).toBe("prof-existing");
    const calls = db.execute.mock.calls.map(([c]) => String(c.sql));
    expect(calls.some((sql) => sql.includes("INSERT INTO investor_profiles"))).toBe(false);
    expect(calls.some((sql) => sql.includes("UPDATE investor_profiles"))).toBe(true);
  });

  test("skips cleanly when there is no contact to attach the profile to", async () => {
    installDb();
    const result = await provisionInvestorFromApproval({ contactCid: "", submission: SUBMISSION, formId: 3 });
    expect(result).toEqual({ skipped: true, reason: "missing_contact" });
    expect(db.execute).not.toHaveBeenCalled();
  });
});

/**
 * Contract tests — coach identity & platform delivery (Vinance 3 Phase 1).
 *
 * Guards:
 *   - resolveCoachContact: explicit coach_contact_id wins; legacy catalog
 *     coach (venture_coaches.email) resolves to a contact by email; missing
 *     matches degrade to null (no delivery, catalog fallback preserved)
 *   - notifyVentureCoach: writes an in-app notification with entity context +
 *     dedupe and emails the coach when resolvable; skips silently otherwise
 *   - GET /api/calendar?personal=1: scopes Venture events to the caller's
 *     assignments ∪ coach sessions; default mode unchanged
 */

const executed = [];

function makeFakeDb() {
  const flags = { contactByCid: true, contactByEmail: true, catalogEmail: "sarah@future.studio", assignments: ["VNT-X"], coachSessions: [], inviteContact: null, inviteActivated: false, alreadyAssigned: false };
  const execute = jest.fn(async (arg) => {
    // Calendar makes one plain-string execute (ALTER TABLE …); normalize.
    const sql = typeof arg === "string" ? arg : arg?.sql;
    const args = typeof arg === "string" ? [] : arg?.args || [];
    executed.push({ sql, args });
    // inviteCoachByEmail — existing contact lookup
    if (sql.includes("SELECT cid, name, email, password FROM contacts WHERE email = ?")) {
      if (flags.inviteContact) {
        return { rows: [{ cid: flags.inviteContact, name: "Sarah", email: args[0], password: flags.inviteActivated ? "hashed" : "" }] };
      }
      return { rows: [] };
    }
    if (sql.includes("SELECT 1 FROM venture_staff_assignments") && sql.includes("status = 'active' LIMIT 1")) {
      return { rows: flags.alreadyAssigned ? [{ 1: 1 }] : [] };
    }
    if (sql.includes("SELECT id FROM venture_staff_assignments") && sql.includes("status = 'active' LIMIT 1")) {
      return { rows: flags.alreadyAssigned ? [{ id: 5 }] : [] };
    }
    // resolveCoachContact — direct contact
    if (sql.includes("SELECT cid, name, email FROM contacts WHERE cid = ?")) {
      return flags.contactByCid ? { rows: [{ cid: "c-sarah", name: "Sarah", email: "sarah@future.studio" }] } : { rows: [] };
    }
    // resolveCoachContact — catalog coach by email
    if (sql.includes("SELECT email FROM venture_coaches WHERE id = ?")) {
      return { rows: [{ email: flags.catalogEmail }] };
    }
    if (sql.includes("SELECT cid, name, email FROM contacts WHERE LOWER(email) = LOWER(?)")) {
      return flags.contactByEmail ? { rows: [{ cid: "c-sarah", name: "Sarah", email: "sarah@future.studio" }] } : { rows: [] };
    }
    // notifyVentureCoach — same contact lookup as direct above
    // calendar: program sources etc default rows [] ; venture sources below
    if (sql.includes("FROM venture_members") && sql.includes("removed_at IS NULL")) {
      return { rows: [{ venture_id: "VNT-X" }] };
    }
    if (sql.includes("FROM venture_staff_assignments") && sql.includes("staff_contact_id = ?")) {
      return { rows: (flags.assignments || []).map((v) => ({ venture_id: v })) };
    }
    if (sql.includes("SELECT DISTINCT venture_id FROM venture_sessions WHERE coach_contact_id = ?")) {
      return { rows: (flags.coachSessions || []).map((v) => ({ venture_id: v })) };
    }
    if (sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id IN")) {
      return { rows: (args || []).filter((a) => a === "VNT-X").map(() => ({ id: "11111111-1111-4111-8111-111111111111", venture_id: "VNT-X" })) };
    }
    if (sql.includes("FROM venture_sessions") && sql.includes("start_time IS NOT NULL")) {
      return {
        rows: [
          { id: 1, title: "Customer Validation", start_time: "2099-01-01T10:00:00Z", coach_name: "Sarah", coach_contact_id: "c-sarah", status: "scheduled" },
          { id: 2, title: "HealthTech Review", start_time: "2099-01-02T10:00:00Z", coach_name: "Other", coach_contact_id: "c-other", status: "scheduled" },
        ],
      };
    }
    if (sql.includes("FROM venture_tasks") && sql.includes("due_date IS NOT NULL")) return { rows: [] };
    if (sql.includes("FROM venture_milestones") && sql.includes("target_date IS NOT NULL")) return { rows: [] };
    if (sql.includes("FROM venture_journey_stages")) return { rows: [] };
    if (sql.includes("INSERT INTO v2_notifications")) return { rows: [{ id: 77 }] };
    return { rows: [] };
  });
  return { execute, flags };
}

const mockDb = makeFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/email", () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendInviteEmail: jest.fn().mockResolvedValue({ success: true }),
  sendLoginEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
}));

const mockAuth = require("@/lib/auth");

const { resolveCoachContact, inviteCoachByEmail } = require("@/lib/ventureCoach");
const { notifyVentureCoach } = require("@/lib/ventureNotify");
const { GET: calendarGET } = require("@/app/api/calendar/route");
const { sendEmail, sendInviteEmail, sendLoginEmail } = require("@/lib/email");
const readJson = async (res) => res.json();

beforeEach(() => {
  executed.length = 0;
  jest.clearAllMocks();
  mockAuth.getSession.mockReset();
  mockAuth.getSession.mockResolvedValue({ cid: "c-sarah", name: "Sarah", role: "staff" });
  mockDb.flags.contactByCid = true;
  mockDb.flags.contactByEmail = true;
  mockDb.flags.catalogEmail = "sarah@future.studio";
  mockDb.flags.assignments = ["VNT-X"];
  mockDb.flags.coachSessions = [];
  mockDb.flags.inviteContact = null;
  mockDb.flags.inviteActivated = false;
  mockDb.flags.alreadyAssigned = false;
});

describe("resolveCoachContact — coach is a platform user (Future Studio staff or invited)", () => {
  test("explicit contact id wins", async () => {
    const c = await resolveCoachContact(mockDb, { coachContactId: "c-sarah" });
    expect(c).toEqual({ cid: "c-sarah", name: "Sarah", email: "sarah@future.studio" });
  });

  test("legacy catalog coach resolves to a contact by email", async () => {
    const c = await resolveCoachContact(mockDb, { coachId: 12 });
    expect(c.cid).toBe("c-sarah");
  });

  test("unmatched catalog coach degrades to null (catalog fallback preserved)", async () => {
    mockDb.flags.contactByEmail = false;
    const c = await resolveCoachContact(mockDb, { coachId: 12 });
    expect(c).toBeNull();
  });

  test("unknown explicit contact degrades to null", async () => {
    mockDb.flags.contactByCid = false;
    const c = await resolveCoachContact(mockDb, { coachContactId: "ghost" });
    expect(c).toBeNull();
  });
});

describe("notifyVentureCoach — automatic coach delivery (in-app + email)", () => {
  test("writes context notification with dedupe and emails the coach", async () => {
    const out = await notifyVentureCoach(mockDb, {
      dbId: "11111111-1111-4111-8111-111111111111",
      coachContactId: "c-sarah",
      title: "Session scheduled",
      message: "You have been added to a session.",
      emailSubject: "You have been added to a Venture session",
      emailLines: ["Session on 10 September.", "Preparation: bring results."],
      context: { journey_stage_id: "s1", milestone_id: "m1", session_id: 9 },
      templateKey: "venture.notif.sessionScheduled",
      params: { title: "Review" },
      dedupeKey: "session-scheduled:9:coach",
    });
    expect(out.sent).toBe(1);

    const notifInsert = executed.find((q) => q.sql.includes("INSERT INTO v2_notifications"));
    expect(notifInsert).toBeDefined();
    expect(notifInsert.args).toEqual(expect.arrayContaining(["c-sarah", "venture.notif.sessionScheduled", "session-scheduled:9:coach"]));

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sarah@future.studio", subject: "You have been added to a Venture session" }),
    );
  });

  test("skips silently when the coach contact cannot be resolved", async () => {
    mockDb.flags.contactByCid = false;
    const out = await notifyVentureCoach(mockDb, { dbId: "x", coachContactId: "ghost", title: "t", message: "m", emailSubject: "s" });
    expect(out.skipped).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();
    const notifInsert = executed.find((q) => q.sql.includes("INSERT INTO v2_notifications"));
    expect(notifInsert).toBeUndefined();
  });

  test("no coach_contact_id → no-op", async () => {
    const out = await notifyVentureCoach(mockDb, { dbId: "x", coachContactId: null, title: "t", message: "m" });
    expect(out.skipped).toBe(true);
  });
});

describe("inviteCoachByEmail — Venture coach invite (program blueprint)", () => {
  test("new external coach → contact created (narrow role) + assignment + activation email", async () => {
    const out = await inviteCoachByEmail(mockDb, {
      code: "VNT-X", ventureName: "AgriNova", email: "new.coach@example.com", name: "New Coach", actorCid: "manager-1", preview: false,
    });
    expect(out.results[0].status).toBe("activation_sent");
    const contactInsert = executed.find((q) => q.sql.startsWith("INSERT INTO contacts"));
    expect(contactInsert).toBeDefined();
    expect(contactInsert.args[2]).toBe("new.coach@example.com");
    expect(contactInsert.sql).toContain("'facilitator'"); // narrow role — NOT staff
    expect(contactInsert.sql).toContain("'pending'");
    const assignmentInsert = executed.find((q) => q.sql.includes("INSERT INTO venture_staff_assignments"));
    expect(assignmentInsert).toBeDefined();
    expect(assignmentInsert.args).toEqual(expect.arrayContaining(["VNT-X", "facilitator", "venture_wide"]));
    const tokenInsert = executed.find((q) => q.sql.includes("INSERT INTO password_setup_tokens"));
    expect(tokenInsert).toBeDefined();
    expect(sendInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "new.coach@example.com", role: "facilitator" }));
    expect(sendLoginEmail).not.toHaveBeenCalled();
  });

  test("existing Future Studio staff contact → assigned as-is, login email, no contact insert", async () => {
    mockDb.flags.inviteContact = "c-staff";
    mockDb.flags.inviteActivated = true;
    const out = await inviteCoachByEmail(mockDb, {
      code: "VNT-X", ventureName: "AgriNova", email: "david@future.studio", responsibilityCode: "lead_manager", actorCid: "sa-1",
    });
    expect(out.results[0].status).toBe("invited");
    expect(out.results[0].responsibility_code).toBe("lead_manager");
    const contactInsert = executed.find((q) => q.sql.startsWith("INSERT INTO contacts"));
    expect(contactInsert).toBeUndefined();
    const assignmentInsert = executed.find((q) => q.sql.includes("INSERT INTO venture_staff_assignments"));
    expect(assignmentInsert.args).toEqual(expect.arrayContaining(["c-staff", "lead_manager"]));
    expect(sendLoginEmail).toHaveBeenCalled();
  });

  test("already assigned → short-circuit without writes or email", async () => {
    mockDb.flags.inviteContact = "c-staff";
    mockDb.flags.inviteActivated = true;
    mockDb.flags.alreadyAssigned = true;
    const out = await inviteCoachByEmail(mockDb, { code: "VNT-X", email: "david@future.studio" });
    expect(out.results[0].status).toBe("already_assigned");
    expect(executed.some((q) => q.sql.includes("INSERT INTO venture_staff_assignments"))).toBe(false);
    expect(sendLoginEmail).not.toHaveBeenCalled();
  });

  test("preview reports without writing", async () => {
    const out = await inviteCoachByEmail(mockDb, { code: "VNT-X", email: "fresh@example.com", preview: true });
    expect(out.results[0].status).toBe("new_contact");
    expect(executed.some((q) => q.sql.startsWith("INSERT INTO contacts"))).toBe(false);
    expect(executed.some((q) => q.sql.includes("INSERT INTO venture_staff_assignments"))).toBe(false);
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  test("invalid email rejected without side effects", async () => {
    const out = await inviteCoachByEmail(mockDb, { code: "VNT-X", email: "not-an-email" });
    expect(out.results[0].status).toBe("invalid");
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });
});

describe("GET /api/calendar — personal mode", () => {
  test("personal=1 restricts to assignments ∪ coach sessions and keeps own non-facing sessions", async () => {
    mockDb.flags.coachSessions = ["22222222-2222-4222-8222-222222222222"];
    const res = await calendarGET(new Request("http://localhost/api/calendar?personal=1&month=1&year=2099"));
    expect(res.status).toBe(200);
    const data = await readJson(res);

    // Scope query ran for a privileged role in personal mode (assignment + coach session venture).
    const scopeQuery = executed.find((q) => q.sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id IN"));
    expect(scopeQuery).toBeDefined();
    // Personal session filter present (coach sees her own even non-facing).
    const sessionQuery = executed.find((q) => q.sql.includes("FROM venture_sessions") && q.sql.includes("start_time IS NOT NULL"));
    expect(sessionQuery.sql).toContain("coach_contact_id = ?");
    // Only Sarah's venture events survive scoping (fixture has 1 assigned venture).
    expect(data.events.every((e) => e.source && String(e.source).startsWith("venture"))).toBe(true);
  });

  test("default mode for privileged roles stays unrestricted (no scope query)", async () => {
    await calendarGET(new Request("http://localhost/api/calendar?month=1&year=2099"));
    const scopeQuery = executed.find((q) => q.sql.includes("SELECT id, venture_id FROM ventures WHERE venture_id IN"));
    expect(scopeQuery).toBeUndefined();
    const sessionQuery = executed.find((q) => q.sql.includes("FROM venture_sessions") && q.sql.includes("start_time IS NOT NULL"));
    expect(sessionQuery.sql).not.toContain("coach_contact_id = ?");
  });
});

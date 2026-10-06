/**
 * The reminder controllers.
 *
 * Two things are locked here that are easy to get wrong later:
 *   1. The Venture reminders route is gated like every other Venture route —
 *      `ventures.view` to read, `ventures.edit` to write — so a Venture Manager
 *      stays inside their own Ventures and nobody gains a new kind of access by
 *      being able to chase work.
 *   2. It writes to the reminder tables and the addresses on file, and to
 *      NOTHING else. Reminders must never become a back door into Venture work.
 */
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => ({})) }));

let mockAccess = { session: { cid: "C1", role: "super_admin", name: "Gwyn" } };
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => mockAccess),
}));

jest.mock("@/lib/ventureOwnership", () => ({
  resolveVentureDbId: jest.fn(async () => "db-1"),
}));

const ITEM = {
  id: "activity:41",
  ref: "MS-01",
  title: "Validate demand",
  owner: { name: "Amina", cid: null, external: true },
  supporting_names: ["David"],
  start: "2026-10-12",
  finish: "2026-10-23",
  is_complete: false,
};
jest.mock("@/services/workItems", () => ({
  buildWorkItems: jest.fn(async () => ({ items: [ITEM] })),
}));

jest.mock("@/models/ventureReminders", () => ({
  selectReminderRules: jest.fn(async () => ({ rows: [] })),
  selectReminderLog: jest.fn(async () => ({ rows: [] })),
  insertReminderRule: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  setReminderRuleActive: jest.fn(async () => ({ rows: [{ id: 7 }] })),
  deleteReminderRule: jest.fn(async () => ({ rows: [{ id: 7 }] })),
}));

jest.mock("@/models/ventureAssigneeEmails", () => ({
  selectAssigneeEmails: jest.fn(async () => ({ rows: [] })),
  selectContactEmailsByCids: jest.fn(async () => ({ rows: [] })),
  upsertAssigneeEmail: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  deleteAssigneeEmail: jest.fn(async () => ({ rows: [] })),
}));

const mockSendManual = jest.fn(async () => ({ sent: 1, already_sent: 0, failed: [], unreachable: [], no_recipients: false }));
jest.mock("@/services/reminders/engine", () => ({
  sendManualReminder: (...args) => mockSendManual(...args),
}));

const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const { upsertAssigneeEmail, deleteAssigneeEmail } = require("@/models/ventureAssigneeEmails");
const { insertReminderRule, deleteReminderRule } = require("@/models/ventureReminders");

function callRoute({ method = "GET", url = "http://localhost/api/ventures/VNT-KORA/reminders", body = null } = {}) {
  const route = require("@/app/api/ventures/[id]/reminders/route");
  const request = new Request(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return route[method](request, { params: Promise.resolve({ id: "VNT-KORA" }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess = { session: { cid: "C1", role: "super_admin", name: "Gwyn" } };
});

describe("the gate", () => {
  test("a read asks for ventures.view", async () => {
    await callRoute();
    expect(requireVentureScopedAccess).toHaveBeenCalledWith({
      ventureId: "VNT-KORA",
      module: "ventures",
      capability: "view",
    });
  });

  test("a write asks for ventures.edit — chasing work is an edit", async () => {
    await callRoute({ method: "POST", body: { action: "send", work_item: "activity:41" } });
    expect(requireVentureScopedAccess).toHaveBeenCalledWith({
      ventureId: "VNT-KORA",
      module: "ventures",
      capability: "edit",
    });
  });

  test("a refusal is returned untouched and nothing is written", async () => {
    mockAccess = { error: { status: 403, json: async () => ({ error: "errors.insufficientPermissions" }) } };

    const response = await callRoute({ method: "POST", body: { action: "send", work_item: "activity:41" } });

    expect(response.status).toBe(403);
    expect(mockSendManual).not.toHaveBeenCalled();
  });
});

describe("reading", () => {
  test("returns the rules and the history, with manual and automatic distinguished", async () => {
    const { selectReminderLog } = require("@/models/ventureReminders");
    selectReminderLog.mockResolvedValue({
      rows: [
        { id: 1, rule_id: 4, trigger: "start", status: "sent" },
        { id: 2, rule_id: null, trigger: "manual", status: "sent" },
      ],
    });

    const body = await (await callRoute()).json();

    expect(body.success).toBe(true);
    expect(body.history[0].mode).toBe("automatic");
    expect(body.history[1].mode).toBe("manual");
  });

  test("for one work item it says who would be reached AND who could not be", async () => {
    const body = await (
      await callRoute({ url: "http://localhost/api/ventures/VNT-KORA/reminders?work_item=activity:41" })
    ).json();

    expect(body.recipients).toHaveLength(2);
    for (const recipient of body.recipients) {
      // Nobody has an address in this fixture — reported, not dropped.
      expect(recipient.email).toBeNull();
      expect(recipient.reason).toBe("external_without_email");
    }
  });
});

describe("sending", () => {
  test("a manual reminder for a work item of THIS Venture is sent", async () => {
    const body = await (await callRoute({ method: "POST", body: { action: "send", work_item: "activity:41" } })).json();

    expect(body.success).toBe(true);
    expect(mockSendManual).toHaveBeenCalledWith(
      expect.objectContaining({ ventureCode: "VNT-KORA", sentBy: "Gwyn" }),
    );
  });

  test("a work item that is not here is a 404, not a send", async () => {
    const response = await callRoute({ method: "POST", body: { action: "send", work_item: "activity:999" } });
    expect(response.status).toBe(404);
    expect(mockSendManual).not.toHaveBeenCalled();
  });

  test("reaching nobody is a 200 with the truth, not an error", async () => {
    mockSendManual.mockResolvedValue({ sent: 0, already_sent: 0, failed: [], unreachable: [], no_recipients: true });

    const response = await callRoute({ method: "POST", body: { action: "send", work_item: "activity:41" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.outcome.no_recipients).toBe(true);
  });
});

describe("the address on file for an off-platform assignee", () => {
  test("a valid address is recorded against the name", async () => {
    const body = await (
      await callRoute({
        method: "POST",
        body: { action: "set_assignee_email", display_name: "Amina", email: "  Amina@Example.com " },
      })
    ).json();

    expect(body.success).toBe(true);
    expect(upsertAssigneeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Amina", email: "amina@example.com" }),
    );
  });

  test("something that is not an address is refused", async () => {
    const response = await callRoute({
      method: "POST",
      body: { action: "set_assignee_email", display_name: "Amina", email: "not-an-email" },
    });

    expect(response.status).toBe(400);
    expect(upsertAssigneeEmail).not.toHaveBeenCalled();
  });

  test("a name is required", async () => {
    const response = await callRoute({
      method: "POST",
      body: { action: "set_assignee_email", display_name: "  ", email: "a@b.com" },
    });
    expect(response.status).toBe(400);
  });

  test("clearing an address removes only the address", async () => {
    await callRoute({ method: "POST", body: { action: "clear_assignee_email", display_name: "Amina" } });
    expect(deleteAssigneeEmail).toHaveBeenCalledWith({ ventureId: "VNT-KORA", displayName: "Amina" });
  });
});

describe("rules", () => {
  test("a rule is added with the days the user chose — never a constant", async () => {
    const body = await (
      await callRoute({
        method: "POST",
        body: { action: "add_rule", trigger: "finish", days_before: 5, notify_owner: true, notify_supporting: true },
      })
    ).json();

    expect(body.rule_id).toBe(7);
    // A Venture rule defaults to the ACTIVITY level: a tracker row is three work
    // items sharing one reference, so a rule covering all of them would email
    // the owner three times.
    expect(insertReminderRule).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: "finish", daysBefore: 5, notifySupporting: true, scope: "venture", workItemKind: "activity" }),
    );
  });

  test("a rule may name another level deliberately", async () => {
    await callRoute({
      method: "POST",
      body: { action: "add_rule", trigger: "finish", days_before: 2, work_item_kind: "milestone" },
    });

    expect(insertReminderRule).toHaveBeenCalledWith(expect.objectContaining({ workItemKind: "milestone" }));
  });

  test("an unknown level falls back to the activity", async () => {
    await callRoute({
      method: "POST",
      body: { action: "add_rule", trigger: "start", days_before: 3, work_item_kind: "everything" },
    });

    expect(insertReminderRule).toHaveBeenCalledWith(expect.objectContaining({ workItemKind: "activity" }));
  });

  test("an unknown trigger is refused", async () => {
    const response = await callRoute({ method: "POST", body: { action: "add_rule", trigger: "whenever", days_before: 3 } });
    expect(response.status).toBe(400);
    expect(insertReminderRule).not.toHaveBeenCalled();
  });

  test("a days-before that is not a usable number is refused", async () => {
    const response = await callRoute({ method: "POST", body: { action: "add_rule", trigger: "start", days_before: -4 } });
    expect(response.status).toBe(400);
    expect(insertReminderRule).not.toHaveBeenCalled();
  });

  test("a rule for another Venture matches nothing", async () => {
    const { setReminderRuleActive } = require("@/models/ventureReminders");
    setReminderRuleActive.mockResolvedValue({ rows: [] });

    const response = await callRoute({ method: "POST", body: { action: "toggle_rule", rule_id: 99, is_active: false } });
    expect(response.status).toBe(404);
  });

  test("delete reports a rule that is not here rather than claiming success", async () => {
    deleteReminderRule.mockResolvedValue({ rows: [] });

    const response = await callRoute({ method: "POST", body: { action: "delete_rule", rule_id: 99 } });
    expect(response.status).toBe(404);
  });

  test("an unknown action is refused", async () => {
    const response = await callRoute({ method: "POST", body: { action: "delete_everything" } });
    expect(response.status).toBe(400);
  });
});

describe("the reminder route writes no Venture work", () => {
  test("no model that writes a task, milestone, journey or deliverable is imported", () => {
    const source = require("fs").readFileSync(
      require("path").join(process.cwd(), "src/app/api/ventures/[id]/reminders/route.js"),
      "utf8",
    );

    expect(source).toMatch(/from "@\/models\/ventureReminders"/);
    expect(source).toMatch(/from "@\/models\/ventureAssigneeEmails"/);
    // The writers that must never appear here.
    for (const forbidden of [
      "venturePlanImportStore",
      "ventureTasksStore",
      "ventureMilestoneStore",
      "insertTask",
      "updateTask",
      "UPDATE venture_tasks",
      "UPDATE venture_milestones",
      "UPDATE venture_deliverables",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

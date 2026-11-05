/**
 * CRM — the next action (Lot 1 decisions).
 *
 * The rule under test: the record's OWNER sets it (a platform owner may repair
 * a record), a label needs a due date, clearing is allowed, and a plain edit
 * never touches the next-action columns. The route also writes one timeline
 * event and raises NO automation trigger.
 */

jest.mock("@/lib/api/createHandler", () => ({
  // Mirrors the real wrapper: it accepts either (handler) or (options, handler).
  createHandler: (handlerOrOptions, maybeHandler) =>
    typeof handlerOrOptions === "function" ? handlerOrOptions : maybeHandler,
}));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/models/authorization/index", () => ({
  requireAuthorization: jest.fn(async () => null),
}));
jest.mock("@/services/contacts/timeline", () => ({
  addContactTimelineEvent: jest.fn(async () => ({})),
}));
jest.mock("@/models/crm/schema", () => ({
  ensureCrmNextActionColumns: jest.fn(async () => {}),
}));
jest.mock("@/models/crm/leads", () => ({
  getCrmLeadById: jest.fn(),
  updateCrmLead: jest.fn(),
  softDeleteCrmLead: jest.fn(),
}));

const { getSession } = require("@/server/auth/session");
const { addContactTimelineEvent } = require("@/services/contacts/timeline");
const { ensureCrmNextActionColumns } = require("@/models/crm/schema");
const { getCrmLeadById, updateCrmLead } = require("@/models/crm/leads");
const { planNextActionWrite, touchesNextAction } = require("@/services/crm/nextAction");
const { PATCH } = require("@/app/api/crm/leads/[id]/route");

const request = (body) => ({ json: async () => body });
const params = { params: Promise.resolve({ id: "lead-1" }) };
const LEAD = {
  id: "lead-1",
  contact_cid: "c-1",
  owner_cid: "owner-1",
  status: "new",
  next_action: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "owner-1", role: "staff" });
  getCrmLeadById.mockResolvedValue({ rows: [{ ...LEAD }] });
  updateCrmLead.mockImplementation(async (_id, updates) => ({
    rows: [{ ...LEAD, ...updates }],
  }));
});

describe("planNextActionWrite", () => {
  const session = { cid: "owner-1", role: "staff" };

  test("only a body that carries the next action is treated as one", () => {
    expect(touchesNextAction({ status: "qualified" })).toBe(false);
    expect(touchesNextAction({ next_action: "Call back" })).toBe(true);
    expect(touchesNextAction({ next_action_due: "2026-11-01" })).toBe(true);
  });

  test("the owner sets a trimmed label and a due date", () => {
    const plan = planNextActionWrite({
      body: { next_action: "  Send the proposal  ", next_action_due: "2026-11-01" },
      existing: LEAD,
      session,
    });
    expect(plan.error).toBeUndefined();
    expect(plan.cleared).toBe(false);
    expect(plan.updates).toMatchObject({
      next_action: "Send the proposal",
      next_action_due: "2026-11-01",
      next_action_set_by: "owner-1",
    });
    expect(plan.updates.next_action_set_at).toBeInstanceOf(Date);
  });

  test("the owner clears it by sending no label", () => {
    const plan = planNextActionWrite({ body: { next_action: "" }, existing: LEAD, session });
    expect(plan.cleared).toBe(true);
    expect(plan.updates).toMatchObject({ next_action: null, next_action_due: null });
  });

  test("a label without a due date is refused", () => {
    const plan = planNextActionWrite({ body: { next_action: "Call back" }, existing: LEAD, session });
    expect(plan).toMatchObject({ error: "crm.activities.nextActionDateRequired", status: 400 });
  });

  test("someone other than the owner is refused", () => {
    const plan = planNextActionWrite({
      body: { next_action: "Call back", next_action_due: "2026-11-01" },
      existing: LEAD,
      session: { cid: "someone-else", role: "staff" },
    });
    expect(plan).toMatchObject({ error: "crm.activities.nextActionOwnerOnly", status: 403 });
  });

  test("a record with no owner must be assigned first", () => {
    const plan = planNextActionWrite({
      body: { next_action: "Call back", next_action_due: "2026-11-01" },
      existing: { ...LEAD, owner_cid: null },
      session: { cid: "someone-else", role: "staff" },
    });
    expect(plan).toMatchObject({ error: "crm.activities.nextActionAssignOwner", status: 403 });
  });

  test("a platform owner may repair any record", () => {
    const plan = planNextActionWrite({
      body: { next_action: "Call back", next_action_due: "2026-11-01" },
      existing: LEAD,
      session: { cid: "admin-1", role: "super_admin" },
    });
    expect(plan.error).toBeUndefined();
    expect(plan.updates.next_action).toBe("Call back");
  });
});

describe("PATCH /api/crm/leads/[id] — next action", () => {
  test("the owner's write is persisted and leaves one timeline event", async () => {
    const response = await PATCH(
      request({ next_action: "Send the proposal", next_action_due: "2026-11-01" }),
      params,
    );

    expect(response.status).toBe(200);
    expect(ensureCrmNextActionColumns).toHaveBeenCalled();
    expect(updateCrmLead).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({
        next_action: "Send the proposal",
        next_action_due: "2026-11-01",
        next_action_set_by: "owner-1",
      }),
    );
    expect(addContactTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({ cid: "c-1", eventType: "next_action_set" }),
    );
  });

  test("a non-owner is refused and nothing is written", async () => {
    getSession.mockResolvedValue({ cid: "intruder", role: "staff" });

    const response = await PATCH(
      request({ next_action: "Send the proposal", next_action_due: "2026-11-01" }),
      params,
    );

    expect(response.status).toBe(403);
    expect(updateCrmLead).not.toHaveBeenCalled();
    expect(addContactTimelineEvent).not.toHaveBeenCalled();
  });

  test("a plain edit does not touch the next-action columns", async () => {
    const response = await PATCH(request({ status: "contacted" }), params);

    expect(response.status).toBe(200);
    expect(updateCrmLead).toHaveBeenCalledWith("lead-1", { status: "contacted" });
    expect(ensureCrmNextActionColumns).not.toHaveBeenCalled();
  });
});

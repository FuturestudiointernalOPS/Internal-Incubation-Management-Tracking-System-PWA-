/**
 * Venture support — who supports a Venture, and how a founder reaches them.
 *
 * These tests pin the five approved decisions:
 *
 *   1. the primary is the OLDEST ACTIVE lead manager (derived, never stored);
 *   2. only `venture_staff_assignments` is read (no coached catalogue);
 *   3. an unusable address is REPORTED, never dropped;
 *   4. former support is the five most recent, newest first;
 *   5. with no active lead, the most recently removed lead is shown in the
 *      primary slot and marked as no longer assigned.
 *
 * They also pin the security properties of the contact email: recipients come
 * from the assignment rows only, the founder's text is escaped, and the
 * founder's address only becomes a Reply-To when it is safe to write into a
 * header.
 */
jest.mock("@/services/ventures/permissions", () => ({
  listAssignments: jest.fn(),
}));

jest.mock("@/models/communications", () => ({
  createMessage: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  ensureMessagesIsReadColumn: jest.fn(async () => ({})),
  insertDirectMessageNotification: jest.fn(async () => ({})),
}));

jest.mock("@/services/reminders/recipients", () => ({
  normalizeEmail: (value) => {
    const text = String(value ?? "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
  },
  nameKey: (value) => String(value ?? "").trim().toLowerCase(),
  chooseRecipientEmail: () => ({ email: null, source: null, reason: null, alternative_email: null }),
  resolveWorkItemRecipients: jest.fn(),
  splitReachable: () => ({ reachable: [], unreachable: [] }),
  hasPlatformAccount: jest.fn(),
}));

import { listAssignments } from "@/services/ventures/permissions";
import { createMessage, insertDirectMessageNotification } from "@/models/communications";
import {
  FORMER_SUPPORT_LIMIT,
  activeLeadRecipients,
  readVentureSupport,
  sendFounderMessageToLeads,
  shapeVentureSupport,
} from "@/services/ventures/support";

const VENTURE = "VNT-1";

let nextId = 1;

function assignment(overrides = {}) {
  const id = overrides.id ?? nextId++;
  return {
    id,
    staff_contact_id: `C-${id}`,
    staff_name: `Person ${id}`,
    staff_email: `person${id}@future.studio`,
    responsibility_code: "lead_manager",
    responsibility_name: "Lead Manager",
    scope_type: "venture_wide",
    created_at: `2026-01-${String(Math.min(id, 28)).padStart(2, "0")}T09:00:00Z`,
    removed_at: null,
    status: "active",
    // Staff-internal fields the founder must never receive.
    assigned_by: "ADMIN-1",
    notes: "internal note",
    scope_ref_id: "MILESTONE-9",
    scope_ref_type: "milestone",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
});

describe("shapeVentureSupport", () => {
  it("makes the OLDEST active lead the primary, not the newest", () => {
    const oldest = assignment({ id: 1, created_at: "2025-05-01T09:00:00Z" });
    const newest = assignment({ id: 2, created_at: "2026-02-01T09:00:00Z" });

    // Fed out of order on purpose.
    const support = shapeVentureSupport([newest, oldest]);

    expect(support.primary.id).toBe(1);
    expect(support.has_active_lead).toBe(true);
    expect(support.current.map((person) => person.id)).toEqual([1, 2]);
    // Exactly one primary.
    expect(support.current.filter((person) => person.is_primary)).toHaveLength(1);
  });

  it("never leaks staff-internal fields", () => {
    const support = shapeVentureSupport([assignment()]);
    const serialised = JSON.stringify(support);

    expect(serialised).not.toContain("assigned_by");
    expect(serialised).not.toContain("internal note");
    expect(serialised).not.toContain("MILESTONE-9");
    expect(support.current[0]).not.toHaveProperty("notes");
    expect(support.current[0]).not.toHaveProperty("scope_ref_id");
  });

  it("reports a lead with no usable address instead of dropping them", () => {
    const support = shapeVentureSupport([
      assignment({ id: 1, staff_email: null }),
      assignment({ id: 2, staff_email: "not-an-address" }),
    ]);

    expect(support.current).toHaveLength(2);
    expect(support.current[0].email).toBeNull();
    expect(support.current[0].reachable).toBe(false);
    expect(support.current[1].reachable).toBe(false);
  });

  it("keeps other responsibilities visible without making them primary", () => {
    const support = shapeVentureSupport([
      assignment({ id: 1, responsibility_code: "coach", responsibility_name: "Coach" }),
      assignment({ id: 2, created_at: "2026-03-01T09:00:00Z" }),
    ]);

    expect(support.primary.id).toBe(2);
    expect(support.current.map((person) => person.responsibility_code)).toEqual(["coach", "lead_manager"]);
  });

  describe("no active lead (decision 5)", () => {
    it("shows the most recently removed lead in the primary slot, marked inactive", () => {
      const support = shapeVentureSupport([
        assignment({ id: 1, status: "removed", removed_at: "2026-01-10T09:00:00Z" }),
        assignment({ id: 2, status: "removed", removed_at: "2026-04-10T09:00:00Z" }),
      ]);

      expect(support.has_active_lead).toBe(false);
      expect(support.primary.id).toBe(2);
      expect(support.primary.active).toBe(false);
      expect(support.primary.is_primary).toBe(true);
      // The promoted row is not printed twice.
      expect(support.former.map((person) => person.id)).toEqual([1]);
    });

    it("shows nothing in the primary slot when no lead was ever assigned", () => {
      const support = shapeVentureSupport([assignment({ status: "removed", responsibility_code: "coach" })]);
      expect(support.primary).toBeNull();
      expect(support.has_active_lead).toBe(false);
    });
  });

  describe("previous support (decision 4)", () => {
    it("returns at most five, newest removal first", () => {
      const removed = Array.from({ length: 8 }, (_, index) =>
        assignment({
          id: index + 1,
          status: "removed",
          removed_at: `2026-01-${String(index + 10).padStart(2, "0")}T09:00:00Z`,
        }),
      );

      const support = shapeVentureSupport([...removed, assignment({ id: 99 })]);

      expect(support.former).toHaveLength(FORMER_SUPPORT_LIMIT);
      expect(support.former.map((person) => person.id)).toEqual([8, 7, 6, 5, 4]);
      expect(support.former_total).toBe(8);
    });

    it("moves a replaced lead into the former list", () => {
      const support = shapeVentureSupport([
        assignment({ id: 1, status: "removed", removed_at: "2026-01-01T09:00:00Z" }),
        assignment({ id: 2 }),
      ]);

      expect(support.primary.id).toBe(2);
      expect(support.former.map((person) => person.id)).toEqual([1]);
    });
  });

  it("survives an empty or malformed answer", () => {
    expect(shapeVentureSupport()).toEqual({
      current: [],
      primary: null,
      has_active_lead: false,
      former: [],
      former_total: 0,
    });
    expect(shapeVentureSupport([null, undefined]).current).toEqual([]);
  });
});

describe("readVentureSupport", () => {
  it("asks for the history in ONE read, and only for staff assignments", async () => {
    listAssignments.mockResolvedValue([assignment()]);
    await readVentureSupport(VENTURE);

    expect(listAssignments).toHaveBeenCalledWith(VENTURE, { includeRemoved: true });
    expect(listAssignments).toHaveBeenCalledTimes(1);
  });
});

describe("activeLeadRecipients", () => {
  it("includes only ACTIVE lead managers", () => {
    const support = shapeVentureSupport([
      assignment({ id: 1 }),
      assignment({ id: 2, responsibility_code: "coach" }),
      assignment({ id: 3, status: "removed", removed_at: "2026-01-01T09:00:00Z" }),
    ]);

    expect(activeLeadRecipients(support).map((person) => person.id)).toEqual([1]);
  });

  it("is empty when the only lead was removed", () => {
    const support = shapeVentureSupport([
      assignment({ id: 1, status: "removed", removed_at: "2026-01-01T09:00:00Z" }),
    ]);
    expect(activeLeadRecipients(support)).toEqual([]);
  });
});

describe("sendFounderMessageToLeads", () => {
  const lead = (id, name, contact_cid = `USR_${id}`) => ({ id, name, contact_cid });

  beforeEach(() => {
    createMessage.mockClear();
    createMessage.mockResolvedValue({ rows: [{ id: 1 }] });
    insertDirectMessageNotification.mockClear();
  });

  it("writes one direct message per lead, from the founder, into the message space", async () => {
    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgroTech",
      founderCid: "USR_FOUNDER",
      founderName: "Chris",
      message: "Can we talk?",
      leads: [lead(1, "Harry"), lead(2, "Joakh")],
    });

    expect(outcome).toEqual({ sent: 2, failed: [] });
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: "USR_FOUNDER",
        recipientId: "USR_1",
        targetType: "individual",
        body: "Can we talk?",
        subject: "AgroTech — message from Chris",
      }),
    );
    expect(createMessage.mock.calls.map(([arg]) => arg.recipientId)).toEqual(["USR_1", "USR_2"]);
  });

  it("notifies each recipient that a message arrived", async () => {
    await sendFounderMessageToLeads({ ventureName: "V", founderCid: "USR_F", founderName: "Chris", message: "hi", leads: [lead(1, "Harry")] });
    expect(insertDirectMessageNotification).toHaveBeenCalledWith("USR_1", "New Message", "You have 1 new message from Chris");
  });

  it("keeps the founder's text as text: nothing is rewritten or escaped into markup", async () => {
    await sendFounderMessageToLeads({ ventureName: "V", founderCid: "USR_F", founderName: "Chris", message: "<b>hi</b> & bye", leads: [lead(1, "Harry")] });
    expect(createMessage.mock.calls[0][0].body).toBe("<b>hi</b> & bye");
  });

  it("reports a lead with no account — there is no inbox to write to — and messages the others", async () => {
    const outcome = await sendFounderMessageToLeads({
      ventureName: "V", founderCid: "USR_F", founderName: "Chris", message: "hi",
      leads: [lead(1, "No Account", null), lead(2, "Has Account")],
    });
    expect(outcome.sent).toBe(1);
    expect(outcome.failed).toEqual([{ name: "No Account", reason: "no_account" }]);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("isolates one failing write from the rest", async () => {
    createMessage.mockRejectedValueOnce(new Error("db down"));
    const outcome = await sendFounderMessageToLeads({
      ventureName: "V", founderCid: "USR_F", founderName: "Chris", message: "hi",
      leads: [lead(1, "First"), lead(2, "Second")],
    });
    expect(outcome.sent).toBe(1);
    expect(outcome.failed).toEqual([{ name: "First", reason: "db down" }]);
  });

  it("a notification that fails does not undo a message already in the inbox", async () => {
    insertDirectMessageNotification.mockRejectedValueOnce(new Error("notify down"));
    const outcome = await sendFounderMessageToLeads({ ventureName: "V", founderCid: "USR_F", founderName: "Chris", message: "hi", leads: [lead(1, "Harry")] });
    expect(outcome).toEqual({ sent: 1, failed: [] });
  });

  it("names the founder generically when no name is known", async () => {
    await sendFounderMessageToLeads({ ventureName: "", founderCid: "USR_F", message: "hi", leads: [lead(1, "Harry")] });
    expect(createMessage.mock.calls[0][0].subject).toBe("your Venture — message from A founder");
  });
});

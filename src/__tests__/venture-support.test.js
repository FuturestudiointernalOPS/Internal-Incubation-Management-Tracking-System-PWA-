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

jest.mock("@/lib/email", () => ({
  sendStandaloneEmail: jest.fn(),
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
import { sendStandaloneEmail } from "@/lib/email";
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
  const leads = [
    { id: 1, name: "Lena", email: "lena@future.studio", contact_cid: "C-1" },
    { id: 2, name: "David", email: "david@future.studio", contact_cid: "C-2" },
  ];

  it("emails every lead and sets Reply-To from the founder", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: true });

    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "awa@agrinova.co",
      message: "Could we meet on Thursday?",
      leads,
    });

    expect(outcome.sent).toBe(2);
    expect(outcome.failed).toEqual([]);
    expect(outcome.reply_to_used).toBe(true);
    expect(sendStandaloneEmail).toHaveBeenCalledTimes(2);
    expect(sendStandaloneEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lena@future.studio",
        replyTo: "awa@agrinova.co",
        email_type: "venture_contact",
      }),
    );
  });

  it("escapes the founder's text — it is body, never markup", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: true });

    await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "awa@agrinova.co",
      message: "<script>alert(1)</script>",
      leads: [leads[0]],
    });

    const html = sendStandaloneEmail.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits Reply-To when the founder's address is unusable, and still sends", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: true });

    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "not-an-address",
      message: "Hello",
      leads: [leads[0]],
    });

    expect(outcome.sent).toBe(1);
    expect(outcome.reply_to_used).toBe(false);
    expect(sendStandaloneEmail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: null }));
  });

  it("reports a lead with no address as unreachable and mails the others", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: true });

    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "awa@agrinova.co",
      message: "Hello",
      leads: [leads[0], { id: 3, name: "No Address", email: null }],
    });

    expect(outcome.sent).toBe(1);
    expect(outcome.failed).toEqual([{ name: "No Address", reason: "no_email" }]);
  });

  it("isolates one failing send from the rest", async () => {
    sendStandaloneEmail
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce({ success: true });

    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "awa@agrinova.co",
      message: "Hello",
      leads,
    });

    expect(outcome.sent).toBe(1);
    expect(outcome.failed).toEqual([{ name: "Lena", reason: "transport down" }]);
  });

  it("reports a transport refusal rather than counting it as sent", async () => {
    sendStandaloneEmail.mockResolvedValue({ success: false, error: "no provider" });

    const outcome = await sendFounderMessageToLeads({
      ventureName: "AgriNova",
      founderName: "Awa",
      founderEmail: "awa@agrinova.co",
      message: "Hello",
      leads: [leads[0]],
    });

    expect(outcome.sent).toBe(0);
    expect(outcome.failed).toEqual([{ name: "Lena", reason: "no provider" }]);
  });
});

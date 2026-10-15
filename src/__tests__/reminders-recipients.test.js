/**
 * WHO a reminder reaches, and WHERE it goes.
 *
 * The one part that can lose a reminder silently, so the rule is pinned here:
 * someone with an IDENTITY is asked for the address on their record — including
 * the people SUPPORTING a piece of work, whose names are text and can hold no
 * identifier of their own — and only a person with no identity falls back to an
 * address typed by hand. Anyone still without an address is RETURNED with a
 * reason, never quietly counted as reached.
 */
jest.mock("@/models/ventureAssigneeEmails", () => ({
  selectAssigneeEmails: jest.fn(async () => ({ rows: [] })),
  selectContactEmailsByCids: jest.fn(async () => ({ rows: [] })),
  selectContactCidByEmail: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/ventureAssigneeLinks", () => ({
  selectAssigneeLinks: jest.fn(async () => ({ rows: [] })),
}));

const {
  selectAssigneeEmails,
  selectContactEmailsByCids,
} = require("@/models/ventureAssigneeEmails");
const { selectAssigneeLinks } = require("@/models/ventureAssigneeLinks");
const { resolveWorkItemRecipients, splitReachable } = require("@/services/reminders/recipients");

const ITEM = {
  id: "activity:41",
  kind: "activity",
  ref: "MS-01",
  title: "Validate Côte d'Ivoire market demand",
  owner: { name: "Amina", cid: null, external: true },
  supporting: "David, Grace",
  supporting_names: ["David", "Grace"],
  start: "2026-10-12",
  finish: "2026-10-23",
  is_complete: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  selectAssigneeEmails.mockResolvedValue({ rows: [] });
  selectContactEmailsByCids.mockResolvedValue({ rows: [] });
  selectAssigneeLinks.mockResolvedValue({ rows: [] });
});

describe("who a reminder reaches", () => {
  test("a person with an account is asked for the address on their record", async () => {
    selectContactEmailsByCids.mockResolvedValue({ rows: [{ cid: "USR_A", email: "Amina@Example.com", deleted: 0 }] });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: "USR_A" } },
    });

    expect(recipients).toEqual([
      { name: "Amina", role: "owner", cid: "USR_A", email: "amina@example.com", source: "contact", reason: null, alternative_email: null },
    ]);
  });

  test("a name with no account uses the address on file for that name", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    const recipients = await resolveWorkItemRecipients({ ventureId: "VNT-1", item: ITEM });
    expect(recipients[0]).toMatchObject({ email: "amina@example.com", source: "on_file" });
  });

  test("a person's own record WINS over an address typed in the reminder bar", async () => {
    // Identifying someone is what decides where their mail goes: the typed
    // address is the fallback for a person with NO identity, so it must not keep
    // overriding the record once the name has been identified.
    selectContactEmailsByCids.mockResolvedValue({ rows: [{ cid: "USR_A", email: "real@example.com", deleted: 0 }] });
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "typed@example.com" }] });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: "USR_A" } },
    });
    expect(recipients[0].email).toBe("real@example.com");
    expect(recipients[0].source).toBe("contact");
    // The unused address is reported rather than silently dropped.
    expect(recipients[0].alternative_email).toBe("typed@example.com");
  });

  test("a name identified for the VENTURE is reached through its record — support included", async () => {
    // A support list is text: the name is the only handle those people have.
    selectAssigneeLinks.mockResolvedValue({ rows: [{ display_name: "David", contact_cid: "USR_D" }] });
    selectContactEmailsByCids.mockResolvedValue({ rows: [{ cid: "USR_D", email: "david@example.com", deleted: 0 }] });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: null }, supporting_names: ["David"] },
      includeSupporting: true,
    });

    const david = recipients.find((entry) => entry.name === "David");
    expect(david.email).toBe("david@example.com");
    expect(david.source).toBe("contact");
    expect(david.cid).toBe("USR_D");
  });

  test("a decision about the NAME wins over an identity written on the assignment", async () => {
    // Two records of "who Amina is"; the one the screen shows and edits decides,
    // otherwise changing it there would change nothing about where mail goes.
    selectAssigneeLinks.mockResolvedValue({ rows: [{ display_name: "Amina", contact_cid: "USR_NEW" }] });
    selectContactEmailsByCids.mockResolvedValue({
      rows: [
        { cid: "USR_NEW", email: "new@example.com", deleted: 0 },
        { cid: "USR_OLD", email: "old@example.com", deleted: 0 },
      ],
    });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: "USR_OLD" } },
    });

    expect(recipients[0].cid).toBe("USR_NEW");
    expect(recipients[0].email).toBe("new@example.com");
  });

  test("an identified person whose record holds no address still uses the typed one", async () => {
    // Reaching them matters more than which field the address came from.
    selectContactEmailsByCids.mockResolvedValue({ rows: [{ cid: "USR_A", email: null, deleted: 0 }] });
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "typed@example.com" }] });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: "USR_A" } },
    });
    expect(recipients[0].email).toBe("typed@example.com");
    expect(recipients[0].source).toBe("on_file");
    expect(recipients[0].alternative_email).toBeNull();
  });

  test("without an address on file, the contact record is still used", async () => {
    selectContactEmailsByCids.mockResolvedValue({ rows: [{ cid: "USR_A", email: "real@example.com", deleted: 0 }] });
    selectAssigneeEmails.mockResolvedValue({ rows: [] });

    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      item: { ...ITEM, owner: { name: "Amina", cid: "USR_A" } },
    });
    expect(recipients[0].email).toBe("real@example.com");
    expect(recipients[0].source).toBe("contact");
  });

  test("someone with no address is RETURNED, with the reason — never dropped", async () => {
    const recipients = await resolveWorkItemRecipients({ ventureId: "VNT-1", item: ITEM, includeSupporting: true });

    expect(recipients).toHaveLength(3);
    const { reachable, unreachable } = splitReachable(recipients);
    expect(reachable).toHaveLength(0);
    expect(unreachable.map((entry) => entry.name)).toEqual(["Amina", "David", "Grace"]);
    expect(unreachable[0].reason).toBe("external_without_email");
  });

  test("an address on file that is not usable says so rather than being used", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "not-an-email" }] });
    const recipients = await resolveWorkItemRecipients({ ventureId: "VNT-1", item: ITEM });
    expect(recipients[0].email).toBeNull();
    expect(recipients[0].reason).toBe("invalid_on_file");
  });

  test("one address is one message, even when named twice", async () => {
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Grace", email: "grace@example.com" }] });
    const recipients = await resolveWorkItemRecipients({
      ventureId: "VNT-1",
      // Grace supports AND owns: she is told once.
      item: { ...ITEM, owner: { name: "Grace", cid: null }, supporting_names: ["Grace", "David"] },
      includeSupporting: true,
    });

    const graces = recipients.filter((entry) => entry.name === "Grace");
    expect(graces).toHaveLength(1);
  });
});

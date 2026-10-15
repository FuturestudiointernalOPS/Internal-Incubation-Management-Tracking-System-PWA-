/**
 * THE PEOPLE a Venture's work names — identifying them, and where a reminder
 * then goes.
 *
 * The rule this file exists to protect: identifying a name CREATES NOTHING. It
 * points at a contact that already exists, the name the tracker wrote is never
 * rewritten, and no account, invitation or membership is touched. The second
 * half is that the identity — not a hand-typed address — is what decides where
 * the mail goes, including for the people SUPPORTING a piece of work, whose
 * names are text and can hold no identifier of their own.
 */
jest.mock("@/lib/db", () => ({ initDb: jest.fn(async () => ({})) }));

let mockAccess = { session: { cid: "C1", role: "super_admin", name: "Gwyn" } };
jest.mock("@/lib/ventureScopedAccess", () => ({
  requireVentureScopedAccess: jest.fn(async () => mockAccess),
}));

jest.mock("@/lib/ventureOwnership", () => ({
  resolveVentureDbId: jest.fn(async () => "db-1"),
}));

jest.mock("@/models/ventureAssignments", () => ({
  listExternalAssignees: jest.fn(async () => []),
}));

jest.mock("@/models/ventureAssigneeEmails", () => ({
  selectAssigneeEmails: jest.fn(async () => ({ rows: [] })),
  selectContactEmailsByCids: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/ventureAssigneeLinks", () => ({
  selectAssigneeLinks: jest.fn(async () => ({ rows: [] })),
  upsertAssigneeLink: jest.fn(async () => ({ rows: [{ id: 1 }] })),
  deleteAssigneeLink: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/services/workItems", () => ({
  buildWorkItems: jest.fn(async () => ({ items: [] })),
}));

const { requireVentureScopedAccess } = require("@/lib/ventureScopedAccess");
const { listExternalAssignees } = require("@/models/ventureAssignments");
const { selectAssigneeEmails, selectContactEmailsByCids } = require("@/models/ventureAssigneeEmails");
const { selectAssigneeLinks, upsertAssigneeLink, deleteAssigneeLink } = require("@/models/ventureAssigneeLinks");
const { buildWorkItems } = require("@/services/workItems");
const { linkNameToContact, listVenturePeople, unlinkName } = require("@/services/ventures/people");

function callRoute({ method = "GET", body = null } = {}) {
  const route = require("@/app/api/ventures/[id]/people/route");
  const request = new Request("http://localhost/api/ventures/VNT-KORA/people", {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  return route[method](request, { params: Promise.resolve({ id: "VNT-KORA" }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccess = { session: { cid: "C1", role: "super_admin", name: "Gwyn" } };
  listExternalAssignees.mockResolvedValue([]);
  selectAssigneeEmails.mockResolvedValue({ rows: [] });
  selectContactEmailsByCids.mockResolvedValue({ rows: [] });
  selectAssigneeLinks.mockResolvedValue({ rows: [] });
  buildWorkItems.mockResolvedValue({ items: [] });
});

describe("WHICH PERSON a name is", () => {
  test("a name identified once covers every mention of it, owner and support alike", async () => {
    listExternalAssignees.mockResolvedValue([{ name: "Amina", total: 9, levels: { task: 9 } }]);
    buildWorkItems.mockResolvedValue({
      items: [{ supporting_names: ["Amina", "David"] }, { supporting_names: ["David"] }],
    });
    selectAssigneeLinks.mockResolvedValue({ rows: [{ display_name: "Amina", contact_cid: "c-amina" }] });
    selectContactEmailsByCids.mockResolvedValue({
      rows: [{ cid: "c-amina", name: "Amina Sossou", email: "amina@example.com", deleted: 0 }],
    });

    const { people, summary } = await listVenturePeople({ ventureCode: "VNT-KORA", dbId: "db-1" });

    const amina = people.find((entry) => entry.name === "Amina");
    expect(amina.roles.sort()).toEqual(["owner", "supporting"]);
    expect(amina.assignments).toBe(9);
    expect(amina.supporting_items).toBe(1);
    expect(amina.contact).toEqual({ cid: "c-amina", name: "Amina Sossou", email: "amina@example.com" });
    expect(amina.email).toBe("amina@example.com");
    expect(amina.source).toBe("contact");

    const david = people.find((entry) => entry.name === "David");
    expect(david.supporting_items).toBe(2);
    expect(david.contact).toBeNull();
    expect(david.email).toBeNull();
    expect(david.reason).toBe("external_without_email");

    expect(summary).toMatchObject({ total: 2, identified: 1, unidentified: 1, reachable: 1, unreachable: 1 });
  });

  test("the identity decides the address, and the unused one is reported", async () => {
    listExternalAssignees.mockResolvedValue([{ name: "Amina", total: 1, levels: { task: 1 } }]);
    selectAssigneeLinks.mockResolvedValue({ rows: [{ display_name: "Amina", contact_cid: "c-amina" }] });
    selectContactEmailsByCids.mockResolvedValue({
      rows: [{ cid: "c-amina", name: "Amina", email: "amina@example.com", deleted: 0 }],
    });
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "typed@example.com" }] });

    const { people } = await listVenturePeople({ ventureCode: "VNT-KORA", dbId: "db-1" });

    expect(people[0].email).toBe("amina@example.com");
    expect(people[0].alternative_email).toBe("typed@example.com");
  });

  test("an unlinked name is reached at the address on file, exactly as before", async () => {
    listExternalAssignees.mockResolvedValue([{ name: "Amina", total: 1, levels: { task: 1 } }]);
    selectAssigneeEmails.mockResolvedValue({ rows: [{ display_name: "Amina", email: "amina@example.com" }] });

    const { people } = await listVenturePeople({ ventureCode: "VNT-KORA", dbId: "db-1" });

    expect(people[0].email).toBe("amina@example.com");
    expect(people[0].source).toBe("on_file");
    expect(people[0].contact).toBeNull();
  });
});

describe("naming a person creates NOTHING", () => {
  test("the contact must already exist — the platform never invents one", async () => {
    selectContactEmailsByCids.mockResolvedValue({ rows: [] });
    const out = await linkNameToContact({ ventureCode: "VNT-KORA", displayName: "Amina", contactCid: "c-ghost" });

    expect(out.error).toBe("errors.notFound");
    expect(upsertAssigneeLink).not.toHaveBeenCalled();
  });

  test("a removed contact is refused rather than linked to nobody reachable", async () => {
    selectContactEmailsByCids.mockResolvedValue([
      { cid: "c-amina", name: "Amina", email: "amina@example.com", deleted: 1 },
    ]);
    const out = await linkNameToContact({ ventureCode: "VNT-KORA", displayName: "Amina", contactCid: "c-amina" });

    expect(out.error).toBe("errors.notFound");
    expect(upsertAssigneeLink).not.toHaveBeenCalled();
  });

  test("linking keeps the tracker's name and records the identity beside it", async () => {
    selectContactEmailsByCids.mockResolvedValue({
      rows: [{ cid: "c-amina", name: "Amina Sossou", email: "amina@example.com", deleted: 0 }],
    });
    const out = await linkNameToContact({
      ventureCode: "VNT-KORA",
      displayName: "Amina",
      contactCid: "c-amina",
      actorCid: "C1",
    });

    expect(out.linked.display_name).toBe("Amina");
    expect(upsertAssigneeLink).toHaveBeenCalledWith({
      ventureId: "VNT-KORA",
      displayName: "Amina",
      contactCid: "c-amina",
      actorCid: "C1",
    });
  });

  test("letting a name go removes the link and nothing else", async () => {
    await unlinkName({ ventureCode: "VNT-KORA", displayName: "Amina" });
    expect(deleteAssigneeLink).toHaveBeenCalledWith({ ventureId: "VNT-KORA", displayName: "Amina" });
  });

  test("a name is required on both sides", async () => {
    expect((await linkNameToContact({ ventureCode: "V", displayName: "  ", contactCid: "c-1" })).error).toBe(
      "display_name required",
    );
    expect((await linkNameToContact({ ventureCode: "V", displayName: "Amina", contactCid: "" })).error).toBe(
      "contact_id required",
    );
    expect((await unlinkName({ ventureCode: "V", displayName: "" })).error).toBe("display_name required");
  });
});

describe("the controller", () => {
  test("a read asks for ventures.view", async () => {
    await callRoute();
    expect(requireVentureScopedAccess).toHaveBeenCalledWith({
      ventureId: "VNT-KORA",
      module: "ventures",
      capability: "view",
    });
  });

  test("a write asks for ventures.edit — naming a person is an edit", async () => {
    await callRoute({ method: "POST", body: { action: "link", display_name: "Amina", contact_id: "c-1" } });
    expect(requireVentureScopedAccess).toHaveBeenCalledWith({
      ventureId: "VNT-KORA",
      module: "ventures",
      capability: "edit",
    });
  });

  test("a refusal is returned untouched and nothing is written", async () => {
    mockAccess = { error: { status: 403, json: async () => ({ error: "errors.insufficientPermissions" }) } };

    const response = await callRoute({ method: "POST", body: { action: "link", display_name: "Amina", contact_id: "c-1" } });

    expect(response.status).toBe(403);
    expect(upsertAssigneeLink).not.toHaveBeenCalled();
  });

  test("a contact the platform does not know is a 400, not a link", async () => {
    selectContactEmailsByCids.mockResolvedValue({ rows: [] });

    const response = await callRoute({
      method: "POST",
      body: { action: "link", display_name: "Amina", contact_id: "c-ghost" },
    });

    expect(response.status).toBe(400);
    expect(upsertAssigneeLink).not.toHaveBeenCalled();
  });

  test("an unknown action is refused", async () => {
    const response = await callRoute({ method: "POST", body: { action: "delete_everything" } });
    expect(response.status).toBe(400);
  });
});

/**
 * The identity a write records comes from the SESSION, never from the body.
 *
 * Two writes used to accept the actor (and, for one of them, the moment) from
 * the caller: posting an announcement attributed it to an `author_id` carried in
 * the body, and archiving a contact stored an `archived_by`/`archived_at` the
 * browser made up out of `localStorage`. Neither was a privilege escalation -
 * both routes already require a capability - but both let the person who holds
 * that capability put somebody else's name, or an arbitrary date, on the record.
 *
 * These tests pin the server as the only source of the actor: the spoofed values
 * below must never reach the write.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
  assertNoParticipantFacilitatorConflict: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/models/communications", () => ({
  createAnnouncement: jest.fn(),
  ensureAnnouncementsTableForInsert: jest.fn().mockResolvedValue(true),
  notifyAllActiveUsersOfAnnouncement: jest.fn().mockResolvedValue(true),
  notifyAnnouncementGroupMembers: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/models/contacts", () => ({
  updateContactFields: jest.fn(),
  deleteContactPrograms: jest.fn().mockResolvedValue(true),
}));

const { getSession } = require("@/lib/auth");
const { createAnnouncement } = require("@/models/communications");
const { updateContactFields } = require("@/models/contacts");

const { POST: postAnnouncement } = require("@/app/api/announcements/route");
const { PUT: putContact } = require("@/app/api/contacts/route");

const jsonReq = (body) => ({ json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/announcements", () => {
  test("attributes the post to the session, ignoring the body's author", async () => {
    getSession.mockResolvedValue({
      cid: "C-REAL",
      name: "Real Person",
      role: "program_manager",
    });
    createAnnouncement.mockResolvedValue({ rows: [{ id: 7 }] });

    const res = await postAnnouncement(
      jsonReq({
        title: "Hello",
        body: "World",
        author_id: "C-SPOOFED",
        author_name: "Someone Else",
        target_type: "all",
      }),
    );
    const data = await res.json();

    expect(data).toEqual({ success: true, id: 7 });
    const announcementArgs = createAnnouncement.mock.calls[0][0];
    expect(announcementArgs.authorId).toBe("C-REAL");
    expect(announcementArgs.authorName).toBe("Real Person");
  });

  test("falls back to the session's email, then cid, for the display name", async () => {
    getSession.mockResolvedValue({ cid: "C-2", email: "two@example.io" });
    createAnnouncement.mockResolvedValue({ rows: [{ id: 8 }] });

    await postAnnouncement(
      jsonReq({ title: "T", body: "B", author_name: "Also Spoofed" }),
    );

    expect(createAnnouncement.mock.calls[0][0].authorName).toBe(
      "two@example.io",
    );
  });
});

describe("PUT /api/contacts (archive / restore)", () => {
  test("archive stores the session actor and the server clock, not the body", async () => {
    getSession.mockResolvedValue({
      cid: "C-STAFF",
      name: "Staff Person",
      email: "s@example.io",
    });
    updateContactFields.mockResolvedValue({ rowsAffected: 1 });

    const res = await putContact(
      jsonReq({
        cid: "C-1",
        archived: true,
        // Both of these used to be written verbatim from the request.
        archived_by: "Someone Else",
        archived_at: "1999-01-01T00:00:00.000Z",
      }),
    );
    expect((await res.json()).success).toBe(true);

    const [fields, args] = updateContactFields.mock.calls[0];
    expect(fields).toEqual(["archived_at = ?", "archived_by = ?"]);
    expect(args[1]).toBe("Staff Person");
    expect(args[2]).toBe("C-1");
    expect(args).not.toContain("Someone Else");
    expect(args[0]).not.toBe("1999-01-01T00:00:00.000Z");
    expect(Number.isNaN(Date.parse(args[0]))).toBe(false);
  });

  test("restore clears both columns", async () => {
    getSession.mockResolvedValue({ cid: "C-STAFF", name: "Staff Person" });
    updateContactFields.mockResolvedValue({ rowsAffected: 1 });

    await putContact(jsonReq({ cid: "C-1", archived: false }));

    const [fields, args] = updateContactFields.mock.calls[0];
    expect(fields).toEqual(["archived_at = ?", "archived_by = ?"]);
    expect(args).toEqual([null, null, "C-1"]);
  });
});

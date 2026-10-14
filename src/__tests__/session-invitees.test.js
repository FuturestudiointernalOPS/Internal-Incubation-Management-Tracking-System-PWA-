/**
 * Session invitations — the invitee list, the .ics file and the e-mail.
 *
 * A session invitee is an E-MAIL, not necessarily an account. When the address
 * belongs to an account it is bound (`contact_cid`) so the calendar can reach
 * it; otherwise the invitation stands alone. The e-mail always carries an
 * "add to my calendar" link and an .ics, so a guest outside ImpactOS can still
 * add the session to their own calendar.
 */
jest.mock("@/models/contactLookupStore", () => ({ selectContactByEmail: jest.fn() }));
jest.mock("@/models/ventureSessionInviteesStore", () => ({
  upsertInvitee: jest.fn(),
  selectInviteesBySession: jest.fn(),
  selectInviteeById: jest.fn(),
  deleteInvitee: jest.fn(),
  selectInvitedSessionsForContact: jest.fn(),
}));
jest.mock("@/lib/email", () => ({ sendStandaloneEmail: jest.fn(async () => ({ success: true })) }));
jest.mock("@/services/integrations/googleCalendar", () => ({ syncUser: jest.fn(async () => ({ ok: false })) }));

const { selectContactByEmail } = require("@/models/contactLookupStore");
const store = require("@/models/ventureSessionInviteesStore");
const { sendStandaloneEmail } = require("@/lib/email");
const { syncUser } = require("@/services/integrations/googleCalendar");
const {
  normalizeInviteEmail,
  addSessionInvitee,
  removeSessionInvitee,
  listSessionInvitees,
} = require("@/services/ventures/sessionInvitees");
const { buildIcsEvent, buildGoogleCalendarUrl } = require("@/lib/calendarIcs");

const SESSION = {
  id: 42,
  title: "Kickoff",
  description: "Plan the first sprint",
  coach_name: "Dr X",
  start_time: "2026-11-02T09:00:00.000Z",
  end_time: "2026-11-02T10:00:00.000Z",
  location: "Room 1",
  meeting_link: "https://meet.example/x",
};

beforeEach(() => jest.clearAllMocks());

describe("normalizeInviteEmail", () => {
  it("trims and lower-cases a valid address", () => {
    expect(normalizeInviteEmail("  Amina@X.io ")).toBe("amina@x.io");
  });

  it("refuses anything that is not an address", () => {
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(normalizeInviteEmail("")).toBeNull();
  });
});

describe("addSessionInvitee", () => {
  it("binds an account by e-mail, stores it and sends the invitation", async () => {
    selectContactByEmail.mockResolvedValue({ rows: [{ cid: "C1", name: "Amina" }] });
    store.upsertInvitee.mockResolvedValue({
      rows: [{ id: 1, session_id: 42, email: "a@x.io", contact_cid: "C1", status: "pending" }],
    });

    const result = await addSessionInvitee({ sessionId: 42, session: SESSION, ventureLabel: "Kora", email: "A@X.io" });

    expect(result.ok).toBe(true);
    expect(selectContactByEmail).toHaveBeenCalledWith("a@x.io");
    expect(store.upsertInvitee).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@x.io", contactCid: "C1", name: "Amina" }),
    );
    expect(sendStandaloneEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@x.io", email_type: "session_invitation" }),
    );
    // An account with a calendar gets the session through its own sync source.
    expect(syncUser).toHaveBeenCalledWith("C1");
  });

  it("keeps a guest with no account — the e-mail still carries the .ics and the link", async () => {
    selectContactByEmail.mockResolvedValue({ rows: [] });
    store.upsertInvitee.mockResolvedValue({
      rows: [{ id: 2, session_id: 42, email: "guest@x.io", contact_cid: null, status: "pending" }],
    });

    const result = await addSessionInvitee({ sessionId: 42, session: SESSION, email: "guest@x.io" });

    expect(result.ok).toBe(true);
    expect(store.upsertInvitee).toHaveBeenCalledWith(expect.objectContaining({ contactCid: null }));
    const sent = sendStandaloneEmail.mock.calls[0][0];
    expect(sent.attachments).toHaveLength(1);
    expect(sent.attachments[0].contentType).toBe("text/calendar");
    expect(sent.html).toContain("calendar.google.com");
    expect(syncUser).not.toHaveBeenCalled();
  });

  it("refuses an invalid address before any write", async () => {
    const result = await addSessionInvitee({ sessionId: 42, session: SESSION, email: "nope" });
    expect(result.ok).toBe(false);
    expect(store.upsertInvitee).not.toHaveBeenCalled();
    expect(sendStandaloneEmail).not.toHaveBeenCalled();
  });

  it("a sent invitation reports itself as sent", async () => {
    store.upsertInvitee.mockResolvedValue({ rows: [{ id: 3, session_id: 42, email: "ok@x.io" }] });
    sendStandaloneEmail.mockResolvedValueOnce({ success: true, provider: "gmail" });

    const result = await addSessionInvitee({ sessionId: 42, session: SESSION, email: "ok@x.io" });

    expect(result.emailResult).toEqual({ sent: true, error: null });
  });

  it("REGRESSION: an invitation that never left says so, instead of looking delivered", async () => {
    // The transport RETURNS its failure (it does not throw), so the caller used
    // to have no way to tell a delivered invitation from a lost one — and the
    // booking confirmed "notified by email" either way.
    store.upsertInvitee.mockResolvedValue({ rows: [{ id: 4, session_id: 42, email: "lost@x.io" }] });
    sendStandaloneEmail.mockResolvedValueOnce({
      success: false,
      provider: "gmail",
      error: "invalid_grant",
    });

    const result = await addSessionInvitee({ sessionId: 42, session: SESSION, email: "lost@x.io" });

    expect(result.ok).toBe(true); // the invite itself stands
    expect(result.emailResult).toEqual({ sent: false, error: "invalid_grant" });
  });
});

describe("list/remove", () => {
  it("reads the invitees of a session", async () => {
    store.selectInviteesBySession.mockResolvedValue({ rows: [{ id: 1 }] });
    expect(await listSessionInvitees(42)).toEqual([{ id: 1 }]);
  });

  it("removes an invitee by id", async () => {
    store.deleteInvitee.mockResolvedValue({ rows: [] });
    await removeSessionInvitee(7);
    expect(store.deleteInvitee).toHaveBeenCalledWith(7);
  });
});

describe("the two calendar artifacts", () => {
  it("builds an .ics with the UTC window and an escaped summary", () => {
    const ics = buildIcsEvent({
      uid: "session-42@impactos",
      title: "Kickoff, day 1",
      startIso: "2026-11-02T09:00:00.000Z",
      endIso: "2026-11-02T10:00:00.000Z",
      location: "Room 1",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261102T090000Z");
    expect(ics).toContain("DTEND:20261102T100000Z");
    expect(ics).toContain("SUMMARY:Kickoff\\, day 1");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("builds a one-click Google link carrying the window", () => {
    const url = buildGoogleCalendarUrl({
      title: "Kickoff",
      startIso: "2026-11-02T09:00:00.000Z",
      endIso: "2026-11-02T10:00:00.000Z",
    });
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("dates=20261102T090000Z%2F20261102T100000Z");
  });

  it("returns nothing when a date is unusable", () => {
    expect(buildIcsEvent({ title: "X", startIso: null })).toBeNull();
    expect(buildGoogleCalendarUrl({ title: "X", startIso: "nonsense" })).toBeNull();
  });
});

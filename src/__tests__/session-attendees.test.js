/**
 * sessionAttendees — WHO gets a real Google invitation for a session.
 *
 * A guest is an address: an external coach or a partner needs no ImpactOS
 * account, because Google sends the invitation from the organiser's own
 * calendar. The rule that makes that safe is the one this file locks:
 *
 *   exactly ONE calendar speaks for a session.
 *
 * Without it the same person would be invited once per connected account — the
 * organiser's calendar, the coach's, every invited member's — which is how a
 * single session becomes four invitations.
 */

// The module reads models at import time; the helper under test is pure, so the
// reads only have to exist.
jest.mock("@/models/workspace", () => ({
  getCalendarSessions: jest.fn(async () => ({ rows: [] })),
  getCalendarFollowups: jest.fn(async () => ({ rows: [] })),
  ensureFollowupsCreatedByColumn: jest.fn(async () => true),
}));
jest.mock("@/models/workspaceCalendarStore", () => ({
  selectCalendarVentureSessions: jest.fn(async () => ({ rows: [] })),
  selectCalendarVentureMilestones: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/models/ventureSessionInviteesStore", () => ({
  selectInvitedSessionsForContact: jest.fn(async () => ({ rows: [] })),
  selectInviteesBySessionIds: jest.fn(async () => ({ rows: [] })),
}));
jest.mock("@/services/workspace", () => ({
  resolveCalendarProgramScope: jest.fn(async () => ({ programScopeSql: "1=0", programScopeArgs: [] })),
  resolveCalendarFollowupVisibility: jest.fn(() => ({ followupVisibilitySql: "1=0", followupVisibilityArgs: [] })),
  resolveCalendarVentureScope: jest.fn(async () => ({ seesAllVentures: false, ventureScope: [], scopeIds: null })),
}));

const { sessionAttendees } = require("@/services/integrations/googleCalendar/timedEvents");

const GUESTS = [
  { email: "coach@external.com", name: "External Coach" },
  { email: "partner@example.org" },
];

describe("who speaks for a session", () => {
  test("the organiser's calendar carries the guest list", () => {
    const attendees = sessionAttendees({
      invitees: GUESTS,
      session: { created_by: "USR_ORGANISER" },
      userId: "USR_ORGANISER",
    });
    expect(attendees).toEqual([
      { email: "coach@external.com", displayName: "External Coach" },
      { email: "partner@example.org" },
    ]);
  });

  test("REGRESSION: anybody else's copy carries no guests — one invitation, not one per account", () => {
    // The coach also has the session on their calendar; if they re-sent the
    // guest list, every guest would be invited a second time.
    expect(
      sessionAttendees({ invitees: GUESTS, session: { created_by: "USR_ORGANISER" }, userId: "USR_COACH" }),
    ).toEqual([]);
  });

  test("the coach speaks for a session nobody is recorded as having created", () => {
    const attendees = sessionAttendees({
      invitees: GUESTS,
      session: { created_by: null, coach_contact_id: "USR_COACH" },
      userId: "USR_COACH",
    });
    expect(attendees).toHaveLength(2);
  });

  test("a recorded creator outranks the coach", () => {
    expect(
      sessionAttendees({
        invitees: GUESTS,
        session: { created_by: "USR_ORGANISER", coach_contact_id: "USR_COACH" },
        userId: "USR_COACH",
      }),
    ).toEqual([]);
  });
});

describe("the guest list itself", () => {
  test("no guests, no attendees", () => {
    expect(
      sessionAttendees({ invitees: [], session: { created_by: "U1" }, userId: "U1" }),
    ).toEqual([]);
    expect(sessionAttendees({ session: { created_by: "U1" }, userId: "U1" })).toEqual([]);
  });

  test("an address typed twice is one attendee", () => {
    const attendees = sessionAttendees({
      invitees: [{ email: "A@One.com" }, { email: " a@one.com " }],
      session: { created_by: "U1" },
      userId: "U1",
    });
    expect(attendees).toEqual([{ email: "a@one.com" }]);
  });

  test("the organiser is the host, never their own guest", () => {
    const attendees = sessionAttendees({
      invitees: [{ email: "me@studio.com", contact_cid: "U1" }, { email: "guest@x.com" }],
      session: { created_by: "U1" },
      userId: "U1",
    });
    expect(attendees).toEqual([{ email: "guest@x.com" }]);
  });

  test("a blank address is dropped rather than sent to Google", () => {
    const attendees = sessionAttendees({
      invitees: [{ email: "  " }, { email: null }, { email: "ok@x.com" }],
      session: { created_by: "U1" },
      userId: "U1",
    });
    expect(attendees).toEqual([{ email: "ok@x.com" }]);
  });
});

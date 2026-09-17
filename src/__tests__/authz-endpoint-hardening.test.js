/**
 * AUTHORIZATION HARDENING — endpoints that had NO gate (Category E).
 *
 * Regression contract for four handlers that answered anonymous callers while
 * a sibling handler in the same file was already gated:
 *
 *   1. GET  /api/invites
 *      Leaked LIVE invite tokens (`SELECT *` on a table whose `token` column is
 *      the credential that mints a participant account) to unauthenticated
 *      callers. Now requires the program-management read capability.
 *   2. GET  /api/platform/ai/evaluation-config
 *      Returned a form's stored scoring framework anonymously. Now follows the
 *      Forms capability its PUT/DELETE siblings use.
 *   3. GET  /api/platform/integrations/calendar
 *   4. GET  /api/platform/integrations/notion
 *      Disclosed integration configuration state anonymously. Now follow the
 *      System Settings read capability.
 *
 * The assertions are deliberately about ORDER OF OPERATIONS as well as status:
 * a denial must be returned BEFORE the data is read, so the gate cannot be
 * defeated by a later failure.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/models/groups", () => ({
  ensureInvitationsTable: jest.fn(async () => {}),
  createInvitation: jest.fn(async () => {}),
  listActiveInvites: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/models/platformAi", () => ({
  getEvaluationFrameworkByFormId: jest.fn(async () => ({ rows: [] })),
  upsertFormEvaluationFramework: jest.fn(async () => {}),
  deleteEvaluationFrameworkByFormId: jest.fn(async () => {}),
}));

jest.mock("@/lib/integrations/calendar/sync", () => ({
  checkCalendarHealth: jest.fn(async () => ({ configured: true })),
  syncRunDeadlines: jest.fn(async () => ({})),
  unsyncRunDeadlines: jest.fn(async () => ({})),
  syncAllRunDeadlines: jest.fn(async () => ({})),
}));

jest.mock("@/lib/integrations/notion/sync", () => ({
  checkNotionHealth: jest.fn(() => ({ configured: true })),
  syncSubmission: jest.fn(async () => ({})),
  syncAllSubmissions: jest.fn(async () => ({})),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { listActiveInvites } = require("@/models/groups");
const { getEvaluationFrameworkByFormId } = require("@/models/platformAi");
const { checkCalendarHealth } = require("@/lib/integrations/calendar/sync");
const { checkNotionHealth } = require("@/lib/integrations/notion/sync");

const { GET: invitesGET } = require("@/app/api/invites/route");
const { GET: evaluationConfigGET } = require("@/app/api/platform/ai/evaluation-config/route");
const { GET: calendarHealthGET } = require("@/app/api/platform/integrations/calendar/route");
const { GET: notionHealthGET } = require("@/app/api/platform/integrations/notion/route");

const denied = () => new Response(JSON.stringify({ success: false }), { status: 403 });
const req = (url) => new Request(url);

beforeEach(() => {
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
});

describe("GET /api/invites requires authorization", () => {
  test("denial is returned and NO invite data is read", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await invitesGET(req("http://localhost/api/invites?program_id=P1"));

    expect(res.status).toBe(403);
    expect(requireAuthorization).toHaveBeenCalledWith("programs", "view");
    // The credential listing must not run at all when the caller is denied.
    expect(listActiveInvites).not.toHaveBeenCalled();
  });

  test("an authorized caller still gets the invites", async () => {
    listActiveInvites.mockResolvedValueOnce({ rows: [{ id: 1, program_id: "P1" }] });
    const res = await invitesGET(req("http://localhost/api/invites?program_id=P1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invites).toHaveLength(1);
    expect(listActiveInvites).toHaveBeenCalledWith("P1");
  });
});

describe("GET /api/platform/ai/evaluation-config requires authorization", () => {
  test("denial is returned before the framework is read", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await evaluationConfigGET(req("http://localhost/api/platform/ai/evaluation-config?form_id=F1"));

    expect(res.status).toBe(403);
    expect(requireAuthorization).toHaveBeenCalledWith("forms", "view");
    expect(getEvaluationFrameworkByFormId).not.toHaveBeenCalled();
  });

  test("an authorized caller still gets the framework", async () => {
    getEvaluationFrameworkByFormId.mockResolvedValueOnce({
      rows: [{ framework: { criteria: [] }, source_document: null }],
    });
    const res = await evaluationConfigGET(req("http://localhost/api/platform/ai/evaluation-config?form_id=F1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.framework).toEqual({ criteria: [] });
  });
});

describe("integration health probes require authorization", () => {
  test("calendar health denies before probing the provider", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await calendarHealthGET(req("http://localhost/api/platform/integrations/calendar?action=health"));

    expect(res.status).toBe(403);
    expect(requireAuthorization).toHaveBeenCalledWith("settings", "view");
    expect(checkCalendarHealth).not.toHaveBeenCalled();
  });

  test("notion health denies before disclosing configuration", async () => {
    requireAuthorization.mockResolvedValueOnce(denied());
    const res = await notionHealthGET(req("http://localhost/api/platform/integrations/notion?action=health"));

    expect(res.status).toBe(403);
    expect(requireAuthorization).toHaveBeenCalledWith("settings", "view");
    expect(checkNotionHealth).not.toHaveBeenCalled();
  });

  test("an authorized caller still gets the calendar health", async () => {
    const res = await calendarHealthGET(req("http://localhost/api/platform/integrations/calendar?action=health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(checkCalendarHealth).toHaveBeenCalled();
  });
});

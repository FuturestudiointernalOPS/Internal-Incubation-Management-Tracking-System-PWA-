/**
 * LMS SESSION RESOURCES — Phase 8 tests
 *
 * The material attached to a Program session (videos + documents, with the
 * "recommended" flag and note), as authored by a Program Manager.
 *
 * Runs the REAL services + routes against the shared fake LMS DB.
 */

const { createFakeDb } = require("./helpers/fakeLmsDb");
const mockFake = createFakeDb();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: mockFake.execute, transaction: mockFake.transaction },
  initDb: jest.fn(async () => {}),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
  getSession: jest.fn(async () => ({ cid: "U-LEARNER", name: "Learner", role: "participant" })),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

const { requireAuthorization } = require("@/lib/authorization");
const { getSession } = require("@/lib/auth");

const {
  createSessionResource,
  listSessionResources,
  updateSessionResource,
  deleteSessionResource,
} = require("@/lib/lms/sessionResources");

const { GET: resourcesGET, POST: resourcesPOST } = require("@/app/api/lms/session-resources/route");
const {
  PUT: resourcePUT,
  DELETE: resourceDELETE,
} = require("@/app/api/lms/session-resources/[id]/route");

const jsonReq = (body, url = "http://localhost/api/lms/test") =>
  new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const readJson = async (res) => res.json();

const PROGRAM = "P-2026-001";
const SESSION = "S-1";

function seedProgram() {
  mockFake.seed("v2_programs", [
    { id: PROGRAM, name: "Advanced Venture Creation Track", assigned_pm_id: "U-PM" },
  ]);
}

function seedSession(overrides = {}) {
  mockFake.seed("v2_sessions", [
    {
      id: SESSION,
      program_id: PROGRAM,
      title: "Week 1 — Discovery",
      week_number: 1,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  mockFake.reset();
  jest.clearAllMocks();
  requireAuthorization.mockResolvedValue(null);
  getSession.mockResolvedValue({ cid: "U-LEARNER", name: "Learner", role: "participant" });
});

// ─── Session resources ─────────────────────────────────────────────────────

describe("lms session resources — service", () => {
  test("a resource requires a program id", async () => {
    await expect(
      createSessionResource({ programId: "", sessionId: SESSION, title: "T", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.programIdRequired");
  });

  test("the program must exist", async () => {
    await expect(
      createSessionResource({ programId: "P-MISSING", title: "T", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.programNotFound");
  });

  test("the session must belong to the program", async () => {
    seedProgram();
    seedSession({ program_id: "P-OTHER" });
    await expect(
      createSessionResource({ programId: PROGRAM, sessionId: SESSION, title: "T", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.sessionNotFound");
  });

  test("a title is required", async () => {
    seedProgram();
    seedSession();
    await expect(
      createSessionResource({ programId: PROGRAM, sessionId: SESSION, title: "  ", url: "https://x.test/a.pdf" }),
    ).rejects.toThrow("lms.errors.resourceTitleRequired");
  });

  test("a link is required and must be http(s)", async () => {
    seedProgram();
    seedSession();
    await expect(
      createSessionResource({ programId: PROGRAM, sessionId: SESSION, title: "Doc" }),
    ).rejects.toThrow("lms.errors.resourceUrlRequired");
    await expect(
      createSessionResource({
        programId: PROGRAM,
        sessionId: SESSION,
        title: "Doc",
        url: "javascript:alert(1)",
      }),
    ).rejects.toThrow("lms.errors.resourceUrlInvalid");
    await expect(
      createSessionResource({ programId: PROGRAM, sessionId: SESSION, title: "Doc", url: "not-a-url" }),
    ).rejects.toThrow("lms.errors.resourceUrlInvalid");
  });

  test("an unknown kind is rejected", async () => {
    seedProgram();
    seedSession();
    await expect(
      createSessionResource({
        programId: PROGRAM,
        sessionId: SESSION,
        kind: "podcast",
        title: "Doc",
        url: "https://x.test/a.pdf",
      }),
    ).rejects.toThrow("lms.errors.invalidResourceKind");
  });

  test("creates a video resource and inherits the week from the session", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      kind: "video",
      title: "Founder interview",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      isRecommended: true,
      recommendationNote: "Watch before the workshop",
      createdBy: "U-PM",
    });
    expect(resource.kind).toBe("video");
    expect(resource.week_number).toBe(1);
    expect(resource.is_recommended).toBe(true);
    expect(resource.recommendation_note).toBe("Watch before the workshop");
    expect(resource.created_by).toBe("U-PM");
    expect(resource.position).toBe(0);
  });

  test("a recommendation note is dropped when the resource is not recommended", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Slides",
      url: "https://x.test/slides.pdf",
      recommendationNote: "should not be stored",
    });
    expect(resource.is_recommended).toBe(false);
    expect(resource.recommendation_note).toBeNull();
    expect(resource.kind).toBe("document"); // default kind
  });

  test("listing is scoped to the session and can isolate recommendations", async () => {
    seedProgram();
    seedSession();
    seedSession({ id: "S-2", title: "Week 2", week_number: 2 });
    await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Toolkit",
      url: "https://x.test/toolkit.pdf",
      isRecommended: true,
      recommendationNote: "Bring it filled in",
    });
    await createSessionResource({
      programId: PROGRAM,
      sessionId: "S-2",
      title: "Other week",
      url: "https://x.test/other.pdf",
    });

    const forSession = await listSessionResources({ programId: PROGRAM, sessionId: SESSION });
    expect(forSession.map((r) => r.title)).toEqual(["Reader", "Toolkit"]);

    const recommended = await listSessionResources({
      programId: PROGRAM,
      sessionId: SESSION,
      onlyRecommended: true,
    });
    expect(recommended).toHaveLength(1);
    expect(recommended[0].title).toBe("Toolkit");
  });

  test("update toggles the recommendation and rewrites the link", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    const updated = await updateSessionResource(resource.id, {
      is_recommended: true,
      recommendation_note: "Start here",
      url: "https://x.test/reader-v2.pdf",
    });
    expect(updated.is_recommended).toBe(true);
    expect(updated.recommendation_note).toBe("Start here");
    expect(updated.url).toBe("https://x.test/reader-v2.pdf");
  });

  test("update rejects an invalid link and an unknown resource", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    await expect(updateSessionResource(resource.id, { url: "ftp://x.test/a" })).rejects.toThrow(
      "lms.errors.resourceUrlInvalid",
    );
    await expect(updateSessionResource("nope", { title: "X" })).rejects.toThrow(
      "lms.errors.resourceNotFound",
    );
  });

  test("delete removes the row", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    await deleteSessionResource(resource.id);
    expect(mockFake.state.lms_session_resources).toHaveLength(0);
    await expect(deleteSessionResource(resource.id)).rejects.toThrow("lms.errors.resourceNotFound");
  });
});

describe("lms session resources — routes", () => {
  test("GET without a program id fails fast", async () => {
    const res = await resourcesGET(new Request("http://localhost/api/lms/session-resources"));
    expect(res.status).toBe(400);
  });

  test("GET returns the program's resources", async () => {
    seedProgram();
    seedSession();
    await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });
    const res = await resourcesGET(
      new Request(`http://localhost/api/lms/session-resources?program_id=${PROGRAM}`),
    );
    const data = await readJson(res);
    expect(data.success).toBe(true);
    expect(data.resources).toHaveLength(1);
  });

  test("POST is gated by lms.assign", async () => {
    const denied = new Response("{}", { status: 403 });
    requireAuthorization.mockResolvedValueOnce(denied);
    const res = await resourcesPOST(
      jsonReq({
        program_id: PROGRAM,
        session_id: SESSION,
        title: "Reader",
        url: "https://x.test/reader.pdf",
      }),
    );
    expect(res).toBe(denied);
    expect(requireAuthorization).toHaveBeenCalledWith("lms", "assign");
  });

  test("POST creates the resource with the session as author", async () => {
    seedProgram();
    seedSession();
    getSession.mockResolvedValueOnce({ cid: "U-PM", name: "PM", role: "program_manager" });
    const res = await resourcesPOST(
      jsonReq({
        program_id: PROGRAM,
        session_id: SESSION,
        title: "Reader",
        url: "https://x.test/reader.pdf",
      }),
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.resource.title).toBe("Reader");
    expect(data.resource.created_by).toBe("U-PM");
  });

  test("PUT and DELETE round out the authoring lifecycle", async () => {
    seedProgram();
    seedSession();
    const resource = await createSessionResource({
      programId: PROGRAM,
      sessionId: SESSION,
      title: "Reader",
      url: "https://x.test/reader.pdf",
    });

    const put = await resourcePUT(
      jsonReq({ is_recommended: true, recommendation_note: "Read first" }),
      { params: Promise.resolve({ id: resource.id }) },
    );
    const putData = await readJson(put);
    expect(putData.resource.is_recommended).toBe(true);

    const del = await resourceDELETE(jsonReq({}), {
      params: Promise.resolve({ id: resource.id }),
    });
    expect((await readJson(del)).success).toBe(true);
  });
});

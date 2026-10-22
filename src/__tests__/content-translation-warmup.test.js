/**
 * Warming the translation memory BEFORE the visit — step 3.
 *
 * Step 1 translated on demand: the first reader paid for it. This suite pins the
 * three moments that move the work earlier — a write, a read, and the scheduled
 * sweep — plus the two properties that make the sweep safe to run forever:
 *
 *   1. it rotates (a Venture already warmed is not the first one every time);
 *   2. one broken Venture does not stop the others.
 *
 * The translations themselves are covered by `content-translation.test.js`; here
 * the translator is mocked, because what is being tested is WHEN it is asked.
 */

const WORK_PAYLOAD = {
  items: [
    {
      title: "Discovery",
      activity: "Validate demand",
      deliverable: "Report",
      journey: { id: "j1", name: "Phase 1" },
      milestone: { id: "m1", title: "Validate" },
    },
  ],
  options: { journeys: [{ id: "j1", name: "Phase 1" }], milestones: [{ id: "m1", title: "Validate" }] },
};

function loadWarmService({ due = [], build } = {}) {
  jest.resetModules();

  const models = {
    ensureContentTranslationsTable: jest.fn(async () => {}),
    selectVenturesDueForTranslationSweep: jest.fn(async () => ({ rows: due })),
    markVentureTranslationSwept: jest.fn(async () => ({ rows: [] })),
  };
  const translation = {
    TRANSLATION_LANGUAGES: ["en", "fr"],
    translateContent: jest.fn(async () => ({
      translations: {},
      fromMemory: 1,
      translated: 2,
      failed: 0,
    })),
  };
  const workItems = {
    buildWorkItems: jest.fn(build || (async () => WORK_PAYLOAD)),
  };

  jest.doMock("@/models/contentTranslations", () => models);
  jest.doMock("@/services/translations/contentTranslation", () => translation);
  jest.doMock("@/services/workItems", () => workItems);

  const service = require("@/services/translations/ventureContent");
  return { ...service, models, translation, workItems };
}

describe("warmVenturePayloadTranslations", () => {
  test("translates the payload's distinct prose into the other language", async () => {
    const { warmVenturePayloadTranslations, translation } = loadWarmService();

    const report = await warmVenturePayloadTranslations({ payload: WORK_PAYLOAD });

    expect(report.texts).toBe(5); // Discovery, Validate demand, Report, Phase 1, Validate
    expect(report.sourceLang).toBe("en");
    expect(report.pairs).toEqual(["fr"]);
    expect(translation.translateContent).toHaveBeenCalledTimes(1);

    const [request] = translation.translateContent.mock.calls[0];
    expect(request.sourceLang).toBe("en");
    expect(request.targetLang).toBe("fr");
    expect(request.texts).toEqual([
      "Discovery",
      "Validate demand",
      "Report",
      "Phase 1",
      "Validate",
    ]);
  });

  test("an empty payload costs nothing", async () => {
    const { warmVenturePayloadTranslations, translation } = loadWarmService();

    const report = await warmVenturePayloadTranslations({ payload: { items: [], options: {} } });

    expect(report.texts).toBe(0);
    expect(translation.translateContent).not.toHaveBeenCalled();
  });
});

describe("runTranslationSweep", () => {
  test("warms the Venture it is given, and records that it did", async () => {
    const { runTranslationSweep, workItems, models } = loadWarmService();

    const report = await runTranslationSweep({ ventureRef: "VNT-1" });

    expect(workItems.buildWorkItems).toHaveBeenCalledWith({ dbId: "VNT-1", ventureCode: "VNT-1" });
    expect(report.ventures).toBe(1);
    expect(report.translated).toBe(2);
    expect(models.markVentureTranslationSwept).toHaveBeenCalledWith("VNT-1");
  });

  test("without a Venture it takes the ones the rotation says are due", async () => {
    const { runTranslationSweep, models } = loadWarmService({
      due: [{ venture_ref: "VNT-1" }, { venture_ref: "VNT-2" }],
    });

    const report = await runTranslationSweep({ limit: 2, maxAgeMinutes: 30 });

    expect(models.selectVenturesDueForTranslationSweep).toHaveBeenCalledWith({
      limit: 2,
      maxAgeMinutes: 30,
    });
    expect(report.ventures).toBe(2);
    expect(models.markVentureTranslationSwept.mock.calls.map((call) => call[0])).toEqual([
      "VNT-1",
      "VNT-2",
    ]);
  });

  test("one broken Venture does not stop the rotation", async () => {
    const build = jest.fn(async ({ dbId }) => {
      if (dbId === "VNT-1") throw new Error("read failed");
      return WORK_PAYLOAD;
    });
    const { runTranslationSweep, models } = loadWarmService({
      due: [{ venture_ref: "VNT-1" }, { venture_ref: "VNT-2" }],
      build,
    });

    const report = await runTranslationSweep();

    expect(report.ventures).toBe(1);
    expect(report.errors).toBe(1);
    expect(models.markVentureTranslationSwept.mock.calls.map((call) => call[0])).toEqual(["VNT-2"]);
  });
});

// ─── the scheduled controller ───────────────────────────────────────────────

describe("POST /api/translations/sweep", () => {
  const ENV = process.env.CRON_SECRET;

  afterEach(() => {
    if (ENV === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ENV;
  });

  function loadSweepRoute({ authorized = true } = {}) {
    jest.resetModules();
    process.env.CRON_SECRET = "s3cret";

    const sweep = jest.fn(async () => ({ ventures: 3, texts: 9, translated: 4, fromMemory: 5, failed: 0, errors: 0 }));

    jest.doMock("@/lib/db", () => ({ __esModule: true, default: {}, initDb: jest.fn(async () => ({})) }));
    jest.doMock("@/services/authorization/scheduledSweeps", () => ({
      resolveSweepAuthorization: () => (authorized ? { ok: true } : { ok: false, error: "errors.notConfigured", status: 503 }),
      secretMatches: (presented, configured) => Boolean(presented) && presented === configured,
    }));
    jest.doMock("@/services/translations/ventureContent", () => ({ runTranslationSweep: sweep }));

    const route = require("@/app/api/translations/sweep/route");
    return { route, sweep };
  }

  const call = (url, secret) =>
    new Request(url, { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} });

  test("a configured secret runs the sweep", async () => {
    const { route, sweep } = loadSweepRoute();

    const response = await route.POST(call("http://localhost/api/translations/sweep?limit=5", "s3cret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.ventures).toBe(3);
    expect(sweep).toHaveBeenCalledWith({ ventureRef: null, limit: "5", maxAgeMinutes: null });
  });

  test("a wrong secret is refused and nothing is swept", async () => {
    const { route, sweep } = loadSweepRoute();

    const response = await route.POST(call("http://localhost/api/translations/sweep", "nope"));

    expect(response.status).toBe(403);
    expect(sweep).not.toHaveBeenCalled();
  });

  test("an unconfigured secret refuses the run instead of opening it", async () => {
    const { route, sweep } = loadSweepRoute({ authorized: false });

    const response = await route.POST(call("http://localhost/api/translations/sweep", "anything"));

    expect(response.status).toBe(503);
    expect(sweep).not.toHaveBeenCalled();
  });
});

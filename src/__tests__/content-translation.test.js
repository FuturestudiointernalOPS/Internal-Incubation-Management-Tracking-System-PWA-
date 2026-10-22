/**
 * Content translation — the shared, remembered process.
 *
 * THE PROBLEM THIS LOCKS SHUT
 *
 * The public form translates one string at a time, in the browser, and remembers
 * nothing. Copied onto a Venture's work screen that is a thousand calls for one
 * page and a dead free quota by lunchtime. This suite pins the three savings that
 * make the shared process affordable, because each of them can regress silently:
 *
 *   1. DEDUPLICATION — the same word printed on nine rows is one translation;
 *   2. MEMORY — a text translated once is never sent to the provider again;
 *   3. BOUNDARIES — a reference code, an acronym or a person's name is not prose
 *      and is never sent anywhere.
 *
 * It also pins the two failure behaviours that decide whether the screen still
 * works: a provider failure is NOT remembered (so a later attempt can succeed),
 * and a memory outage degrades to translating, never to a blank answer.
 */

const PATHS = [
  "items[].title",
  "items[].journey.name",
  "items[].milestone.title",
  "items[].definition_of_done",
  "options.milestones[].title",
];

function loadService({ remembered = [], translate } = {}) {
  jest.resetModules();

  const model = {
    ensureContentTranslationsTable: jest.fn(async () => {}),
    selectContentTranslations: jest.fn(async () => ({ rows: remembered })),
    insertContentTranslations: jest.fn(async () => ({ rows: [] })),
  };
  const provider = {
    MYMEMORY_PROVIDER: "test-provider",
    translateText: jest.fn(translate || (async (text) => `fr:${text}`)),
  };

  jest.doMock("@/models/contentTranslations", () => model);
  jest.doMock("@/services/translations/providers/mymemory", () => provider);

  const service = require("@/services/translations/contentTranslation");
  return { ...service, model, provider };
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

// ─── the pure collector ───────────────────────────────────────────────────────

describe("collectTexts", () => {
  const { collectTexts } = require("@/lib/contentTranslation");

  test("reads declared paths, including nested objects and lists", () => {
    const payload = {
      items: [
        {
          title: "Market validation",
          journey: { name: "Discovery" },
          milestone: { title: "Validate" },
          definition_of_done: "Twenty interviews done",
        },
      ],
      options: { milestones: [{ title: "Validate" }] },
    };

    expect(collectTexts(payload, PATHS)).toEqual([
      "Market validation",
      "Discovery",
      "Validate",
      "Twenty interviews done",
    ]);
  });

  test("collapses duplicates: one word printed many times is one text", () => {
    const payload = {
      items: [
        { title: "Validate", journey: { name: "Discovery" }, milestone: { title: "Validate" } },
        { title: "Validate", journey: { name: "Discovery" }, milestone: { title: "Validate" } },
        { title: "Validate", journey: { name: "Discovery" }, milestone: { title: "Validate" } },
      ],
    };

    expect(collectTexts(payload, PATHS)).toEqual(["Validate", "Discovery"]);
  });

  test("never collects a reference, an acronym or an empty value", () => {
    const payload = {
      items: [
        { title: "VNT-12", journey: { name: "MVP" }, milestone: { title: "   " } },
        { title: "Go-to-market", journey: { name: "OKR" }, milestone: { title: "Phase 1" } },
        { title: null },
      ],
    };

    expect(collectTexts(payload, PATHS)).toEqual(["Go-to-market", "Phase 1"]);
  });

  test("a missing payload or a missing branch is simply nothing", () => {
    expect(collectTexts(null, PATHS)).toEqual([]);
    expect(collectTexts({}, PATHS)).toEqual([]);
    expect(collectTexts({ items: null }, PATHS)).toEqual([]);
  });
});

// ─── the language guess ──────────────────────────────────────────────────────

describe("detectContentLanguage", () => {
  const { detectContentLanguage } = require("@/lib/contentTranslation");

  test("a French corpus is French", () => {
    expect(
      detectContentLanguage([
        "Validation du marché",
        "Vingt entretiens réalisés et synthétisés",
        "Rapport de synthèse pour les partenaires",
      ]),
    ).toBe("fr");
  });

  test("an English corpus is English", () => {
    expect(
      detectContentLanguage([
        "Market validation",
        "Twenty customer interviews completed",
        "Summary report for the board",
      ]),
    ).toBe("en");
  });

  test("a corpus of codes and product names stays English (the safe default)", () => {
    expect(detectContentLanguage(["MVP", "VNT-12", "OKR", "Phase 1"])).toBe("en");
  });

  test("nothing at all stays English", () => {
    expect(detectContentLanguage([])).toBe("en");
    expect(detectContentLanguage(["", null, undefined])).toBe("en");
  });
});

// ─── the process ─────────────────────────────────────────────────────────────

describe("translateContent", () => {
  test("the same language pair is a no-op", async () => {
    const { translateContent, model, provider } = loadService();

    const result = await translateContent({
      texts: ["Market validation"],
      sourceLang: "en",
      targetLang: "en",
    });

    expect(result.translations).toEqual({});
    expect(provider.translateText).not.toHaveBeenCalled();
    expect(model.selectContentTranslations).not.toHaveBeenCalled();
  });

  test("a text already in the memory is never sent to the provider", async () => {
    const { translateContent, model, provider } = loadService({
      remembered: [{ source_text: "Market validation", translated_text: "Validation du marché" }],
    });

    const result = await translateContent({
      texts: ["Market validation"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(result.translations).toEqual({ "Market validation": "Validation du marché" });
    expect(result.fromMemory).toBe(1);
    expect(result.translated).toBe(0);
    expect(provider.translateText).not.toHaveBeenCalled();
    expect(model.insertContentTranslations).not.toHaveBeenCalled();
  });

  test("only the missing texts are translated, and each distinct text once", async () => {
    const { translateContent, model, provider } = loadService({
      remembered: [{ source_text: "Market validation", translated_text: "Validation du marché" }],
    });

    const result = await translateContent({
      texts: ["Market validation", "Discovery", "Discovery", "Discovery"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(provider.translateText).toHaveBeenCalledTimes(1);
    expect(provider.translateText).toHaveBeenCalledWith("Discovery", "en", "fr");
    expect(result.translations.Discovery).toBe("fr:Discovery");
    expect(result.translated).toBe(1);

    const [rows] = model.insertContentTranslations.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceLang: "en",
      targetLang: "fr",
      sourceText: "Discovery",
      translatedText: "fr:Discovery",
      provider: "test-provider",
    });
    // The memory is keyed on the TEXT, so the row carries a hash of it.
    expect(rows[0].sourceHash).toMatch(/^[0-9a-f]{32}$/);
  });

  test("a provider failure is reported and NEVER remembered", async () => {
    const { translateContent, model } = loadService({ translate: async () => null });

    const result = await translateContent({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(result.translations).toEqual({});
    expect(result.failed).toBe(1);
    expect(model.insertContentTranslations).not.toHaveBeenCalled();
  });

  test("a memory outage still translates: it costs money, not the screen", async () => {
    const { translateContent, model, provider } = loadService();
    model.selectContentTranslations.mockRejectedValueOnce(new Error("database is down"));

    const result = await translateContent({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(provider.translateText).toHaveBeenCalledWith("Discovery", "en", "fr");
    expect(result.translations.Discovery).toBe("fr:Discovery");
  });

  test("a failed memory write still answers the reader", async () => {
    const { translateContent, model } = loadService();
    model.insertContentTranslations.mockRejectedValueOnce(new Error("deadlock detected"));

    const result = await translateContent({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(result.translations.Discovery).toBe("fr:Discovery");
  });

  test("codes, acronyms and blanks are never sent anywhere", async () => {
    const { translateContent, provider } = loadService();

    await translateContent({
      texts: ["VNT-12", "MVP", "   ", "OKR", "Phase 1"],
      sourceLang: "en",
      targetLang: "fr",
    });

    expect(provider.translateText).toHaveBeenCalledTimes(1);
    expect(provider.translateText).toHaveBeenCalledWith("Phase 1", "en", "fr");
  });

  test("the provider's answers are remembered for the next visitor", async () => {
    const { translateContent, model } = loadService();

    await translateContent({
      texts: ["Discovery", "Validate"],
      sourceLang: "en",
      targetLang: "fr",
    });

    const [rows] = model.insertContentTranslations.mock.calls[0];
    expect(rows.map((row) => row.sourceText).sort()).toEqual(["Discovery", "Validate"]);
  });
});

// ─── the controller: the Venture gate comes before the provider ─────────────

describe("POST /api/translations", () => {
  function loadRoute({ access = { error: null, session: { cid: "C-1" } } } = {}) {
    jest.resetModules();

    const service = {
      MAX_TEXTS_PER_REQUEST: 200,
      isTranslationLanguage: (code) => ["en", "fr"].includes(code),
      translateContent: jest.fn(async () => ({
        translations: { Discovery: "Découverte" },
        fromMemory: 0,
        translated: 1,
        failed: 0,
      })),
    };
    const guard = jest.fn(async () => access);

    // The middleware wrapper is not what this suite is about; the route's own
    // validation and gate are.
    jest.doMock("@/lib/api/createHandler", () => ({ createHandler: (handler) => handler }));
    jest.doMock("@/lib/ventureScopedAccess", () => ({ requireVentureScopedAccess: guard }));
    jest.doMock("@/services/translations/contentTranslation", () => service);

    const route = require("@/app/api/translations/route");
    const call = (body) => route.POST({ json: async () => body });
    return { call, service, guard };
  }

  test("translates the texts of a Venture the caller may read", async () => {
    const { call, service, guard } = loadRoute();

    const response = await call({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
      ventureId: "VNT-1",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.translations).toEqual({ Discovery: "Découverte" });
    expect(guard).toHaveBeenCalledWith({ ventureId: "VNT-1", module: "ventures", capability: "view" });
    expect(service.translateContent).toHaveBeenCalledWith({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
    });
  });

  test("a denied Venture answers the guard's refusal, never a translation", async () => {
    const refusal = { status: 403 };
    const { call, service } = loadRoute({ access: { error: refusal } });

    const response = await call({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "fr",
      ventureId: "VNT-OTHER",
    });

    expect(response).toBe(refusal);
    expect(service.translateContent).not.toHaveBeenCalled();
  });

  test("a request without a Venture is refused before anything is read", async () => {
    const { call, service, guard } = loadRoute();

    const response = await call({ texts: ["Discovery"], sourceLang: "en", targetLang: "fr" });

    expect(response.status).toBe(400);
    expect(guard).not.toHaveBeenCalled();
    expect(service.translateContent).not.toHaveBeenCalled();
  });

  test("an unsupported language pair is refused", async () => {
    const { call, service } = loadRoute();

    const response = await call({
      texts: ["Discovery"],
      sourceLang: "en",
      targetLang: "de",
      ventureId: "VNT-1",
    });

    expect(response.status).toBe(400);
    expect(service.translateContent).not.toHaveBeenCalled();
  });

  test("a batch above the ceiling is refused", async () => {
    const { call, service } = loadRoute();

    const response = await call({
      texts: Array.from({ length: 201 }, (_, index) => `Text ${index}`),
      sourceLang: "en",
      targetLang: "fr",
      ventureId: "VNT-1",
    });

    expect(response.status).toBe(400);
    expect(service.translateContent).not.toHaveBeenCalled();
  });
});

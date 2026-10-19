/**
 * "The run overrides the form" — characterisation of every precedence rule the
 * Forms vs Runs cleanup (task 2) touches. Written BEFORE the refactor and kept
 * unchanged after it: the same inputs must give the same outputs.
 *
 *  - scoring, run-detail read (GET /api/platform/form-runs?scoring=<id>)
 *  - scoring, submit path (calculateSubmissionScores)
 *  - the Runs screen's automation switches (runAutomationActions)
 *  - the delay and template resolvers ("0" and "" are decisions)
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));
jest.mock("@/models/authorization/index", () => ({ requireAuthorization: jest.fn(async () => null) }));
jest.mock("@/services/platform/formRuns", () => ({ buildRunDetail: jest.fn() }));
jest.mock("@/app/api/platform/form-runs/handlers/scheduleResultSweep", () => ({ scheduleResultSweep: jest.fn() }));

const mockFormRuns = {
  getScoringSubmissionById: jest.fn(),
  getRunContextForScoringById: jest.fn(),
  getFormScoringConfigById: jest.fn(),
  getRunScoringSettingsById: jest.fn(),
  getFormScoringSettingsById: jest.fn(),
};
jest.mock("@/models/formRuns", () => mockFormRuns);

const { GET } = require("@/app/api/platform/form-runs/handlers/get");
const { calculateSubmissionScores } = require("@/services/platform/scoring");
const { runAutomationActions } = require("@/app/platform/runs/actions/runAutomation");
const { getTemplate, getDesignedTemplate, resolveResultDelayMinutes } = require("@/lib/email/templates");

const ON = (label) => ({ enabled: true, label, sections: { S: { weight: 100, field_labels: ["Q"] } } });
const OFF = (label) => ({ enabled: false, label, sections: { S: { weight: 100, field_labels: ["Q"] } } });

beforeEach(() => jest.clearAllMocks());

// [case, run settings, form settings (null = no form row), expected label | null]
const SCORING_CASES = [
  ["run enabled wins over an enabled form", { scoring: ON("run") }, { scoring: ON("form") }, "run"],
  ["run enabled, form row missing", { scoring: ON("run") }, null, "run"],
  ["run enabled:false falls through to the form", { scoring: OFF("run") }, { scoring: ON("form") }, "form"],
  ["run without scoring falls through to the form", {}, { scoring: ON("form") }, "form"],
  ["neither enabled", { scoring: OFF("run") }, { scoring: OFF("form") }, null],
  ["nothing configured", {}, {}, null],
  ["run settings null, form enabled", null, { scoring: ON("form") }, "form"],
  ["form row missing, run off", { scoring: OFF("run") }, null, null],
];

describe("scoring precedence — run-detail read", () => {
  const read = async (runSettings, formSettings, { noRun = false } = {}) => {
    mockFormRuns.getScoringSubmissionById.mockResolvedValue({ rows: [{ id: 1, run_id: 2, data: {} }] });
    mockFormRuns.getRunContextForScoringById.mockResolvedValue({
      rows: noRun ? [] : [{ id: 2, form_id: 3, name: "Run", settings: runSettings }],
    });
    mockFormRuns.getFormScoringConfigById.mockResolvedValue({
      rows: formSettings === null ? [] : [{ settings: formSettings }],
    });
    const res = await GET(new Request("http://localhost/api/platform/form-runs?scoring=1"));
    return (await res.json()).scoring_config;
  };

  test.each(SCORING_CASES)("%s", async (_case, runSettings, formSettings, expected) => {
    const config = await read(runSettings, formSettings);
    expect(config?.label ?? null).toBe(expected);
  });

  test("the form is not read when the run decides", async () => {
    await read({ scoring: ON("run") }, { scoring: ON("form") });
    expect(mockFormRuns.getFormScoringConfigById).not.toHaveBeenCalled();
  });

  test("no run → no config", async () => {
    expect(await read({}, { scoring: ON("form") }, { noRun: true })).toBeNull();
  });
});

describe("scoring precedence — submit path", () => {
  const score = async (runSettings, formSettings, data = { Q: 5 }) => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({ rows: [{ form_id: 3, settings: runSettings }] });
    mockFormRuns.getFormScoringSettingsById.mockResolvedValue({
      rows: formSettings === null ? [] : [{ settings: formSettings }],
    });
    return calculateSubmissionScores(2, data);
  };

  test.each(SCORING_CASES)("%s", async (_case, runSettings, formSettings, expected) => {
    const result = await score(runSettings, formSettings);
    expect(result ? "scored" : null).toBe(expected ? "scored" : null);
  });

  test("the form is not read when the run decides", async () => {
    await score({ scoring: ON("run") }, { scoring: ON("form") });
    expect(mockFormRuns.getFormScoringSettingsById).not.toHaveBeenCalled();
  });

  test("an enabled run without sections scores nothing (no fallthrough)", async () => {
    expect(await score({ scoring: { enabled: true } }, { scoring: ON("form") })).toBeNull();
  });

  test("run not found → null", async () => {
    mockFormRuns.getRunScoringSettingsById.mockResolvedValue({ rows: [] });
    expect(await calculateSubmissionScores(2, { Q: 5 })).toBeNull();
  });
});

describe("Runs screen automation switches", () => {
  const actions = (runFormSettings, runSettings) =>
    runAutomationActions({ runFormSettings, runSettings, setRunSettings: () => {} });

  // [case, form settings, run settings, effective, run overrides this flag]
  test.each([
    ["absent everywhere → ON", undefined, undefined, true, false],
    ["empty objects → ON", {}, {}, true, false],
    ["form false", { automation: { on_approve: { send_approval_email: false } } }, {}, false, false],
    ["form true", { automation: { on_approve: { send_approval_email: true } } }, {}, true, false],
    ["run true beats form false", { automation: { on_approve: { send_approval_email: false } } }, { automation: { on_approve: { send_approval_email: true } } }, true, true],
    ["run false beats form true", { automation: { on_approve: { send_approval_email: true } } }, { automation: { on_approve: { send_approval_email: false } } }, false, true],
    ["run blank falls through", { automation: { on_approve: { send_approval_email: false } } }, { automation: { on_approve: { send_approval_email: "" } } }, false, false],
    ["run null falls through to ON", {}, { automation: { on_approve: { send_approval_email: null } } }, true, false],
    ["non-object automation ignored", { automation: "off" }, { automation: 7 }, true, false],
    ["another flag's override does not count", {}, { automation: { on_approve: { send_activation_email: false } } }, true, false],
  ])("%s", (_case, form, run, effective, overridden) => {
    const { runAutomationValue, isRunAutomationOverride } = actions(form, run);
    expect(runAutomationValue("on_approve", "send_approval_email")).toBe(effective);
    expect(isRunAutomationOverride("on_approve", "send_approval_email")).toBe(overridden);
  });
});

describe("delay and templates — 0 and blank are decisions", () => {
  test.each([
    ["absent everywhere → 0", {}, {}, 0],
    ["form minutes", { automation: { templates: { result: { delay_minutes: 30 } } } }, {}, 30],
    ["form legacy hours", { automation: { templates: { result: { delay_hours: 2 } } } }, {}, 120],
    ["run explicit 0 stops the form's delay", { automation: { templates: { result: { delay_minutes: 30 } } } }, { templates: { result: { delay_minutes: 0 } } }, 0],
    ["run blank falls through", { automation: { templates: { result: { delay_minutes: 30 } } } }, { templates: { result: { delay_minutes: "" } } }, 30],
    ["run negative ignored", { automation: { templates: { result: { delay_minutes: 30 } } } }, { templates: { result: { delay_minutes: -5 } } }, 30],
  ])("%s", (_case, form, run, expected) => {
    expect(resolveResultDelayMinutes(form, run)).toBe(expected);
  });

  test("a blank run field falls through to the form, then to the default", () => {
    const form = { automation: { templates: { result: { subject: "Form subject", body: "" } } } };
    const run = { templates: { result: { subject: "   ", body: "Run body" } } };
    expect(getDesignedTemplate(form, "result", run)).toEqual({ subject: "Form subject", body: "Run body" });
    expect(getDesignedTemplate({}, "result", {})).toEqual({ subject: "", body: "" });
    expect(typeof getTemplate({}, "rejection", {}).subject).toBe("string");
  });
});

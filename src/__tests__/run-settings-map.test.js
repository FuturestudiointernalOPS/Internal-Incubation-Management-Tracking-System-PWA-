/**
 * The run/form settings map, the shared scoring rule
 * (`@/lib/platform/runSettings`) and the generalised settings loader.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

import { RUN_SETTINGS_MAP, resolveRunScoring } from "@/lib/platform/runSettings";
import { isRunAutomationFlagOverride, hasRunAutomationOverride } from "@/lib/platform/automationSettings";

describe("resolveRunScoring", () => {
  const on = { enabled: true };
  test.each([
    ["run enabled wins", { scoring: { ...on, id: "form" } }, { scoring: { ...on, id: "run" } }, "run"],
    ["run enabled:false falls through", { scoring: { ...on, id: "form" } }, { scoring: { enabled: false, id: "run" } }, "form"],
    ["absent run falls through", { scoring: { ...on, id: "form" } }, {}, "form"],
    ["nothing enabled", { scoring: { enabled: false } }, { scoring: { enabled: false } }, null],
    ["null settings", null, null, null],
  ])("%s", (_case, form, run, expected) => {
    expect(resolveRunScoring(form, run)?.id ?? null).toBe(expected);
  });

  test("returns the stored object itself, never a rebuilt one", () => {
    const run = { scoring: { enabled: true, sections: {}, extra: 1 } };
    expect(resolveRunScoring({}, run)).toBe(run.scoring);
  });
});

describe("isRunAutomationFlagOverride", () => {
  test.each([
    [undefined, false],
    [{ automation: 7 }, false],
    [{ automation: { on_approve: { send_approval_email: null } } }, false],
    [{ automation: { on_approve: { send_approval_email: "" } } }, false],
    [{ automation: { on_approve: { send_approval_email: false } } }, true],
    [{ automation: { on_approve: { send_approval_email: true } } }, true],
  ])("%p → %p", (run, expected) => {
    expect(isRunAutomationFlagOverride(run, "on_approve.send_approval_email")).toBe(expected);
  });

  test("hasRunAutomationOverride is unchanged", () => {
    expect(hasRunAutomationOverride({ automation: { on_approve: { send_approval_email: false } } })).toBe(true);
    expect(hasRunAutomationOverride({ automation: { on_approve: { send_approval_email: null } } })).toBe(false);
    expect(hasRunAutomationOverride({ automation: "x" })).toBe(false);
  });
});

test("every documented key has a level, a rule and a default", () => {
  for (const entry of Object.values(RUN_SETTINGS_MAP)) {
    expect(["form", "run", "both"]).toContain(entry.level);
    expect(typeof entry.rule).toBe("string");
    expect(entry).toHaveProperty("default");
  }
});

test("the old loader name stays an alias of getRunSettingsContextById", () => {
  const formRuns = require("@/models/formRuns");
  expect(typeof formRuns.getRunSettingsContextById).toBe("function");
  expect(formRuns.getRunTemplateSettingsForDecisionById).toBe(formRuns.getRunSettingsContextById);
});

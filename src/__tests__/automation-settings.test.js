/**
 * Run-level automation switches — run → form → on.
 *
 * The FORM carries the designed default, the RUN decides, and only an explicit
 * boolean at either level counts as a decision. Everything else falls through,
 * which is what makes "clear the run override" work without writing `true`
 * everywhere, and what keeps a form or run that never configured automation
 * sending exactly what it sends today.
 */
const {
  resolveAutomationFlag,
  effectiveAutomation,
  hasRunAutomationOverride,
  AUTOMATION_FLAG_PATHS,
} = require("@/lib/platform/automationSettings");

const PATH = "on_approve.send_approval_email";
const formOff = { automation: { on_approve: { send_approval_email: false } } };
const formOn = { automation: { on_approve: { send_approval_email: true } } };

describe("resolveAutomationFlag", () => {
  test("absent everywhere means ON — the historic default", () => {
    expect(resolveAutomationFlag(undefined, undefined, PATH)).toBe(true);
    expect(resolveAutomationFlag({}, {}, PATH)).toBe(true);
    expect(resolveAutomationFlag(null, null, PATH)).toBe(true);
  });

  test("the form's value is the default while the run has none", () => {
    expect(resolveAutomationFlag(formOff, {}, PATH)).toBe(false);
    expect(resolveAutomationFlag(formOff, undefined, PATH)).toBe(false);
    expect(resolveAutomationFlag(formOn, {}, PATH)).toBe(true);
  });

  test("the run wins, in both directions", () => {
    expect(
      resolveAutomationFlag(formOff, { automation: { on_approve: { send_approval_email: true } } }, PATH),
    ).toBe(true);
    expect(
      resolveAutomationFlag(formOn, { automation: { on_approve: { send_approval_email: false } } }, PATH),
    ).toBe(false);
  });

  test("a non-boolean left behind by an editor falls through instead of reading as off", () => {
    const run = { automation: { on_approve: { send_approval_email: null } } };
    expect(resolveAutomationFlag(formOff, run, PATH)).toBe(false);
    expect(resolveAutomationFlag(formOn, { automation: { on_approve: { send_approval_email: "" } } }, PATH)).toBe(true);
  });

  test("one run override does not disturb its siblings", () => {
    const form = {
      automation: { on_approve: { send_approval_email: false, send_activation_email: false } },
    };
    const run = { automation: { on_approve: { send_approval_email: true } } };
    expect(resolveAutomationFlag(form, run, "on_approve.send_approval_email")).toBe(true);
    expect(resolveAutomationFlag(form, run, "on_approve.send_activation_email")).toBe(false);
  });

  test("the three sections resolve independently", () => {
    const form = {
      automation: {
        on_submit: { send_acknowledgement: false },
        on_approve: { enroll_in_program: false },
        on_reject: { send_rejection_email: false },
      },
    };
    expect(resolveAutomationFlag(form, {}, "on_submit.send_acknowledgement")).toBe(false);
    expect(resolveAutomationFlag(form, {}, "on_approve.enroll_in_program")).toBe(false);
    expect(resolveAutomationFlag(form, {}, "on_reject.send_rejection_email")).toBe(false);
    expect(
      resolveAutomationFlag(form, { automation: { on_reject: { send_rejection_email: true } } }, "on_reject.send_rejection_email"),
    ).toBe(true);
    // Untouched flags stay on even while a sibling is off.
    expect(resolveAutomationFlag(form, {}, "on_approve.create_platform_user")).toBe(true);
  });

  test("a malformed settings object never throws", () => {
    expect(resolveAutomationFlag({ automation: "off" }, { automation: 7 }, PATH)).toBe(true);
    expect(resolveAutomationFlag({ automation: { on_approve: null } }, {}, PATH)).toBe(true);
  });
});

describe("effectiveAutomation / hasRunAutomationOverride", () => {
  test("every flag is reported once, all ON by default", () => {
    const effective = effectiveAutomation({}, {});
    expect(Object.keys(effective).sort()).toEqual([...AUTOMATION_FLAG_PATHS].sort());
    expect(Object.values(effective).every((flag) => flag === true)).toBe(true);
  });

  test("the run's overrides show through, the rest inherit", () => {
    const effective = effectiveAutomation(formOff, { automation: { on_approve: { send_approval_email: true } } });
    expect(effective["on_approve.send_approval_email"]).toBe(true);
    expect(effective["on_approve.send_activation_email"]).toBe(true);
  });

  test("hasRunAutomationOverride ignores an empty or absent block", () => {
    expect(hasRunAutomationOverride({})).toBe(false);
    expect(hasRunAutomationOverride({ automation: {} })).toBe(false);
    expect(hasRunAutomationOverride({ automation: { on_approve: { send_approval_email: null } } })).toBe(false);
    expect(hasRunAutomationOverride({ automation: { on_approve: { send_approval_email: false } } })).toBe(true);
  });
});

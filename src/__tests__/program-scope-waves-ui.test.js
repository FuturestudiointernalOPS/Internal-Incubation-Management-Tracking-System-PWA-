/**
 * @jest-environment jsdom
 *
 * PROGRAM SCOPE WAVE SWITCHES — contract test.
 *
 * This is the control that turns programme record scope ON, and the only place
 * in the system where a click removes access for a group of people. Four
 * promises are locked here, because each one is a way an administrator could be
 * misled:
 *
 *   1. THE DIRECTION THAT REMOVES ACCESS IS CONFIRMED, the direction that
 *      restores it is not. A confirmation that also fires when switching off
 *      trains people to click through it.
 *   2. AN UNSAFE WAVE SAYS WHAT BLOCKS IT, before the click and inside the
 *      dialog — the two findings (unmanaged programmes, people left with no
 *      programme) are the repairs to do first.
 *   3. A PARTIAL WAVE SAYS SO, and names the surfaces that stay open. An
 *      administrator must never believe a wave closed a door it did not.
 *   4. A REFUSAL IS A REASON, NOT A CRASH: a missing capability is stated with
 *      the capability's name.
 *
 * i18n runs without a provider, so t(key) returns the key itself: assertions on
 * those keys double as a "this text goes through t()" check.
 *
 * The first describe block is the SOURCE-LEVEL contract (the structure the
 * behaviour depends on); the rest drives the real component.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

const ProgramScopeWaves = require("@/components/permissions/ProgramScopeWaves").default;

const SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "components", "permissions", "ProgramScopeWaves.js"),
  "utf8",
);

const K = (key) => `engineering.permissions.${key}`;

const SAFE_WAVE = {
  wave: "content",
  label: "Program content",
  covers: "Editing and archiving a program's own content",
  enabled: false,
  safe: true,
  blockers: { unmanaged: 0, losesEverything: 0 },
  partial: false,
  covered: true,
  exempt: [],
};

const UNSAFE_WAVE = {
  wave: "enrollment",
  label: "Invitations and enrollment",
  covers: "Program invitations, adding and removing participants",
  enabled: false,
  safe: false,
  blockers: { unmanaged: 3, losesEverything: 2 },
  partial: true,
  covered: false,
  exempt: ["api/v2/invites (legacy V2 route — project instruction: changes go in the V1 counterpart)"],
};

const ENABLED_WAVE = {
  ...SAFE_WAVE,
  wave: "groups",
  label: "Groups and targets",
  covers: "Cohorts/groups and KPI weights",
  enabled: true,
  partial: true,
  covered: false,
  exempt: ["api/v2/groups (legacy V2 route)", "api/v2/kpis (legacy V2 route)"],
};

function makeReport(waveSafety = [SAFE_WAVE]) {
  return {
    waveSafety,
    summary: { wavesEnabled: waveSafety.filter((w) => w.enabled).length, safeToEnable: true },
  };
}

function renderWaves({ waveSafety, onRefresh = jest.fn() } = {}) {
  return {
    onRefresh,
    ...render(<ProgramScopeWaves report={makeReport(waveSafety)} onRefresh={onRefresh} />),
  };
}

const okResponse = (body) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() =>
    okResponse({ success: true, wave: "content", enabled: true, waves: { content: true } }),
  );
});

describe("source-level contract", () => {
  test("the control is a real switch, not a styled div", () => {
    expect(SOURCE).toContain('role="switch"');
    expect(SOURCE).toContain("aria-checked={checked}");
    expect(SOURCE).toMatch(/disabled=\{busy\}/);
  });

  test("the confirmation exists and only the enabling path opens it", () => {
    expect(SOURCE).toContain("<AppModal");
    // The gate is one line and it is the promise being made: `next` true → ask.
    expect(SOURCE).toMatch(/if \(next\) setPending\(row\);\s*\n\s*else applyChange\(row, false\)/);
  });

  test("the three server-declared facts are rendered, not assumed", () => {
    // safe/blockers (the verdict), partial + exempt (the honest coverage claim).
    expect(SOURCE).toContain("row.blockers");
    expect(SOURCE).toContain("row.partial === true");
    expect(SOURCE).toContain("row.exempt");
  });

  test("a refusal and a blocked enable are handled as answers", () => {
    expect(SOURCE).toContain("res.status === 403");
    expect(SOURCE).toContain("permissions.assign_capabilities");
  });

  test("the wave name and the enabled flag are what get sent", () => {
    expect(SOURCE).toMatch(/JSON\.stringify\(\{ wave: row\.wave, enabled \}\)/);
  });

  test("the label is requested as a key first, with the server label as fallback", () => {
    expect(SOURCE).toMatch(/programScopeWaveLabel_\$\{row\.wave\}/);
    expect(SOURCE).toMatch(/programScopeWaveCovers_\$\{row\.wave\}/);
    // The fallback is what keeps a wave added on the server renderable before its
    // translation exists — and it must never be the ONLY path.
    expect(SOURCE).toMatch(/value === key \? row\.label/);
  });
});

describe("rendering the waves", () => {
  test("one switch per wave, reflecting the current state", () => {
    renderWaves({ waveSafety: [SAFE_WAVE, ENABLED_WAVE] });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0].getAttribute("aria-checked")).toBe("false");
    expect(switches[1].getAttribute("aria-checked")).toBe("true");
  });

  test("an unsafe wave names both repairs before any click", () => {
    renderWaves({ waveSafety: [UNSAFE_WAVE] });

    expect(screen.getByText(K("programScopeWaveUnsafeBadge"))).toBeTruthy();
    expect(screen.getByText(K("programScopeWaveBlockerUnmanaged"))).toBeTruthy();
    expect(
      screen.getByText(K("programScopeWaveBlockerLosesEverything")),
    ).toBeTruthy();
    expect(screen.queryByText(K("programScopeWaveSafe"))).toBeNull();
  });

  test("a partial wave says it is not full coverage and lists what stays open", () => {
    renderWaves({ waveSafety: [ENABLED_WAVE] });

    expect(screen.getByText(K("programScopeWavePartialTitle"))).toBeTruthy();
    expect(screen.getByText(K("programScopeWavePartialBody"))).toBeTruthy();
    // The exempt surfaces are server data and are shown verbatim.
    expect(screen.getByText("api/v2/groups (legacy V2 route)")).toBeTruthy();
    expect(screen.getByText("api/v2/kpis (legacy V2 route)")).toBeTruthy();
  });

  test("a fully covered wave does NOT claim otherwise", () => {
    renderWaves({ waveSafety: [SAFE_WAVE] });

    expect(screen.queryByText(K("programScopeWavePartialTitle"))).toBeNull();
  });

  test("the wave label falls back to the server label when no translation is loaded", () => {
    // The component ASKS for a translation key and uses the server-supplied label
    // only as the fallback, so a new wave added on the server still renders while
    // its translation is being written. Without a provider every key resolves to
    // itself, which is exactly the fallback path.
    renderWaves({ waveSafety: [SAFE_WAVE] });

    expect(screen.getByText(SAFE_WAVE.label)).toBeTruthy();
    expect(screen.getByText(SAFE_WAVE.covers)).toBeTruthy();
  });
});

describe("switching a wave ON asks first", () => {
  test("clicking the switch does NOT call the API until it is confirmed", async () => {
    renderWaves({ waveSafety: [SAFE_WAVE] });

    fireEvent.click(screen.getAllByRole("switch")[0]);

    // The dialog is shown, the reason is stated, and NOTHING has been written.
    expect(screen.getByText(K("programScopeWaveConfirmTitle"))).toBeTruthy();
    expect(screen.getByText(K("programScopeWaveConfirmBody"))).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("confirming sends the wave and the enabled flag, then refreshes the panel", async () => {
    const { onRefresh } = renderWaves({ waveSafety: [SAFE_WAVE] });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getByText(K("programScopeWaveConfirmApply")));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/engineering/permissions/program-scope-strictness");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ wave: "content", enabled: true });
    // The counts above the block must not keep showing pre-change numbers.
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  test("cancelling writes nothing", async () => {
    renderWaves({ waveSafety: [SAFE_WAVE] });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getByText("common.cancel"));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("an unsafe wave repeats its blockers inside the confirmation", () => {
    renderWaves({ waveSafety: [UNSAFE_WAVE] });

    fireEvent.click(screen.getAllByRole("switch")[0]);

    // Once in the row, once in the dialog: the reason appears where the click
    // happened, not only above it.
    expect(screen.getAllByText(K("programScopeWaveBlockerUnmanaged"))).toHaveLength(2);
    expect(
      screen.getAllByText(K("programScopeWaveBlockerLosesEverything")),
    ).toHaveLength(2);
  });
});

describe("switching a wave OFF applies immediately", () => {
  test("no confirmation is asked, and the write goes out straight away", async () => {
    renderWaves({ waveSafety: [{ ...SAFE_WAVE, enabled: true }] });

    fireEvent.click(screen.getAllByRole("switch")[0]);

    expect(screen.queryByText(K("programScopeWaveConfirmTitle"))).toBeNull();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      wave: "content",
      enabled: false,
    });
  });
});

describe("refusals are reasons, not crashes", () => {
  test("a 403 names the capability that is missing", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 403, json: async () => ({}) }),
    );
    renderWaves({ waveSafety: [SAFE_WAVE] });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getByText(K("programScopeWaveConfirmApply")));

    await waitFor(() =>
      expect(screen.getByText(K("programScopeWaveForbidden"))).toBeTruthy(),
    );
  });

  test("a server refusal (unsafe to enable) is surfaced as a failure, not silence", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        json: async () => ({ success: false, reason: "not-safe-to-enable" }),
      }),
    );
    renderWaves({ waveSafety: [{ ...SAFE_WAVE, enabled: true }] });

    // Turning OFF is the immediate path, so the refusal lands inline.
    fireEvent.click(screen.getAllByRole("switch")[0]);

    await waitFor(() =>
      expect(screen.getByText(K("programScopeWaveFailedTitle"))).toBeTruthy(),
    );
  });

  test("a thrown network error is reported rather than swallowed", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("offline")));
    renderWaves({ waveSafety: [{ ...SAFE_WAVE, enabled: true }] });

    fireEvent.click(screen.getAllByRole("switch")[0]);

    await waitFor(() =>
      expect(screen.getByText(K("programScopeWaveFailedTitle"))).toBeTruthy(),
    );
  });
});

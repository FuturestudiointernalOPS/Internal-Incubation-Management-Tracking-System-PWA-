/**
 * ACCESS PROFILE CLEANUP — UI contract.
 *
 * Locks the decisions in docs/ACCESS_PROFILE_CLEANUP.md that live in the
 * front end, where no unit test can reach them (the screen is one large
 * client component with its own fetch calls):
 *
 *   1. A profile is configurable ON ITS OWN. It does not have to be a role's
 *      default to be edited, so the editor must show the catalogue — not an
 *      empty grid — when no role is bound.
 *   2. The role picker offers every role the engine enforces, including the
 *      ones served as `extraRoles` (program_manager, teacher, mentor…).
 *   3. Assigning a thinner profile must be CONFIRMED, never silent.
 *   4. Deleting an in-use profile is refused by the server and explained.
 *   5. The "who is affected" number is visible at ZERO too — a dead profile
 *      used to look exactly like a live one.
 *
 * Every assertion below is a regression guard for a defect found in the audit,
 * so a failure means the defect is back, not that the test is stale.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SCREEN = "src/components/permissions/PermissionCenter.js";

const screen = fs.readFileSync(path.join(ROOT, SCREEN), "utf8");
const en = require(path.join(ROOT, "src/locales/en/engineering.json"));
const fr = require(path.join(ROOT, "src/locales/fr/engineering.json"));

// ── 1. A profile is configurable without a role binding ────────────────────

describe("the profile editor does not require a role default", () => {
  test("the whole catalogue is built, then narrowed ONLY for role-bound profiles", () => {
    // The role-less case must fall through to every section.
    expect(screen).toMatch(/const allSections = groupModulesByFeature\(/);
    expect(screen).toMatch(
      /const eligibleSections =\s*\n?\s*selectedIsDefaultFor\.length > 0/,
    );
    expect(screen).toMatch(/: allSections;/);
  });

  test("eligibility is never the unconditional filter any more", () => {
    // The original defect: `filterSectionsByRoleEligibility(...)` applied to
    // every profile, which returned [] for a profile with no role.
    expect(screen).not.toMatch(
      /const eligibleSections = filterSectionsByRoleEligibility\(/,
    );
  });

  test("the copy no longer tells the admin to bind a role first", () => {
    expect(screen).toMatch(/engineering\.permissions\.profileStandaloneHint/);
    expect(screen).not.toMatch(/engineering\.permissions\.profileNoRolesHint/);
    expect(screen).not.toMatch(/engineering\.permissions\.profileNoRolesEmpty/);
  });
});

// ── 2. Every enforced role stays bindable ──────────────────────────────────

describe("the role picker covers the engine's whole vocabulary", () => {
  test("extraRoles is merged into the selectable roles", () => {
    expect(screen).toMatch(/\.\.\.\(eligData\.extraRoles \|\| \[\]\)/);
    // The defect: only `eligData.roles` (the curated 7) was offered, so
    // program_manager / teacher / mentor could not be re-bound.
    expect(screen).not.toMatch(/setAllRoles\(eligData\.roles \|\|/);
  });
});

// ── 3. Assigning a thinner profile is confirmed, never silent ──────────────

describe("the capability-loss guard on assignment", () => {
  test("the 409 diff is surfaced and re-sent only with confirm", () => {
    expect(screen).toMatch(/res\.status === 409 && data\.requiresConfirmation/);
    expect(screen).toMatch(/options\.confirm \? \{ confirm: true \}/);
    expect(screen).toMatch(/return await saveProfileOverride\(profileId, \{ confirm: true \}\)/);
  });

  test("declining the confirmation changes nothing and says so", () => {
    expect(screen).toMatch(/engineering\.permissions\.assignCancelled/);
    // The recursive retry must be gated on an accepted dialog.
    expect(screen).toMatch(/if \(!accepted\) \{/);
  });

  test("the loss is itemised, not only counted", () => {
    expect(screen).toMatch(/loss\.removed/);
    expect(screen).toMatch(/engineering\.permissions\.assignLossMore/);
  });
});

// ── 4. Deletion is refused while a profile is in use ───────────────────────

describe("safe deletion from the front end", () => {
  test("delete calls the API and confirms destructively first", () => {
    expect(screen).toMatch(/\/api\/access-profiles\?id=\$\{encodeURIComponent\(profile\.id\)\}/);
    expect(screen).toMatch(/engineering\.permissions\.deleteProfileConfirm/);
    expect(screen).toMatch(/tone: "danger"/);
  });

  test("each structured refusal is rendered, and its detail is used", () => {
    for (const key of [
      "profile_in_use_assignments",
      "profile_in_use_context",
      "profile_in_use_role_default",
    ]) {
      expect(screen).toMatch(new RegExp(`"${key}"`));
    }
  });

  test("confirmation goes through useDialogs, never the browser's own", () => {
    expect(screen).toMatch(/useDialogs\(\)/);
    expect(screen).not.toMatch(/window\.confirm/);
    expect(screen).not.toMatch(/window\.alert/);
  });
});

// ── 5. A zero-reach profile is visible as such ─────────────────────────────

describe("the impact count is shown at zero", () => {
  test("the count renders whenever it is known", () => {
    expect(screen).toMatch(/impactTotal !== null && \(/);
    // The defect: `impactTotal > 0` hid the number for every dead profile.
    expect(screen).not.toMatch(/impactTotal !== null && impactTotal > 0 && \(/);
  });

  test("context-role bindings are reported separately from people", () => {
    expect(screen).toMatch(/impactContextBindings/);
    expect(screen).toMatch(/engineering\.permissions\.impactContextBindings/);
  });
});

// ── 6. Locale parity for every string this change introduced ───────────────

describe("en/fr parity for the cleanup's new strings", () => {
  const NEW_KEYS = [
    "profileStandaloneHint",
    "profileNoConfigurableFeatures",
    "impactContextBindings",
    "deleteProfileTitle",
    "deleteProfileConfirm",
    "deleteProfileImpactHint",
    "profileDeleted",
    "failedToDeleteProfile",
    "deleteBlockedAssigned",
    "deleteBlockedContext",
    "deleteBlockedRoleDefault",
    "assignImpactTitle",
    "assignEmptyProfileConfirm",
    "assignLossConfirm",
    "assignLossHint",
    "assignLossMore",
    "assignCancelled",
  ];

  test.each(NEW_KEYS)("%s exists and is translated in en + fr", (key) => {
    const enValue = en.engineering?.permissions?.[key];
    const frValue = fr.engineering?.permissions?.[key];
    expect(typeof enValue).toBe("string");
    expect(enValue.length).toBeGreaterThan(0);
    expect(typeof frValue).toBe("string");
    expect(frValue.length).toBeGreaterThan(0);
    // A French string that is identical to the English one is a missed
    // translation, not a translation — catch it here.
    expect(frValue).not.toBe(enValue);
  });

  test("the retired copy is gone from BOTH locales", () => {
    for (const key of ["profileNoRolesHint", "profileNoRolesEmpty"]) {
      expect(en.engineering?.permissions?.[key]).toBeUndefined();
      expect(fr.engineering?.permissions?.[key]).toBeUndefined();
    }
  });
});

/**
 * PHASE UI-7 — access clarity on the Person screen.
 *
 * Locks the three things the screen has to keep distinct:
 *
 *   1. the REPORT of a person's capabilities — what they can do, and where each
 *      right comes from;
 *   2. the EDITORS — the four rights per section, and the special access /
 *      exceptions block;
 *   3. the RESOLUTION RULE they both mirror, so the report can never claim
 *      something the engine would refuse.
 *
 * The rule it locks (authorization resolver, unchanged):
 *
 *   effective = eligible(feature)
 *               AND max(profile, group, direct grant) > 0
 *               AND NOT blocked
 *
 * Sources are UNIONED, not ranked, and a block removes the capability entirely
 * — which is why an origin report lists every holding source, and why a block
 * is reported alone.
 */

const fs = require("fs");
const path = require("path");

const {
  deriveUserCapState,
  deriveDenialReason,
  describeCapOrigins,
  ORIGIN_KEYS,
} = require("@/components/permissions/matrixHelpers");
const {
  createLatestGuard,
} = require("@/components/permissions/effectUtils");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);
const keys = (origins) => origins.map((origin) => origin.key);

const sources = (over = {}) => ({
  profile: {},
  groups: {},
  grants: {},
  restrictions: {},
  ...over,
});

const PERMS = "src/components/permissions/";
const EDITOR = `${PERMS}PermissionCenter.js`;
const REPORT = `${PERMS}PeopleView.js`;
const SPECIAL = `${PERMS}AdvancedCapabilities.js`;

// ─── 1. Late answers (A → B → A) ────────────────────────────────────────────
describe("UI-7 — one person's answer never lands on another", () => {
  test("only the newest read may be applied", () => {
    const guard = createLatestGuard();
    const first = guard.begin();
    expect(guard.isCurrent(first)).toBe(true);

    const second = guard.begin();
    expect(guard.isCurrent(second)).toBe(true);
    // A → B: A's answer arrives late and must be dropped.
    expect(guard.isCurrent(first)).toBe(false);
  });

  test("A → B → A: the first A answer is still stale", () => {
    const guard = createLatestGuard();
    const firstA = guard.begin();
    const readB = guard.begin();
    const secondA = guard.begin();

    expect(guard.isCurrent(firstA)).toBe(false);
    expect(guard.isCurrent(readB)).toBe(false);
    expect(guard.isCurrent(secondA)).toBe(true);
  });

  test("cancelling invalidates what is in flight without a new read", () => {
    const guard = createLatestGuard();
    const token = guard.begin();
    guard.cancel();
    expect(guard.isCurrent(token)).toBe(false);
  });

  test("both lenses guard their reads and check before writing state", () => {
    for (const file of [EDITOR, REPORT]) {
      const src = read(file);
      expect(src).toContain("createLatestGuard");
      expect(src).toContain(".begin()");
      expect(src).toContain("isCurrent(token)");
    }
  });

  test("the editor drops the previous person's rights before loading the next", () => {
    const src = read(EDITOR);
    expect(src).toContain("setUserPerms(null)");
  });
});

// ─── 2. Origin of a capability ──────────────────────────────────────────────
describe("UI-7 — origin report", () => {
  test("inherited from the profile, named", () => {
    const state = deriveUserCapState(
      sources({ profile: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    const origins = describeCapOrigins(state, { profileName: "Manager" });
    expect(keys(origins)).toEqual([ORIGIN_KEYS.profile]);
    expect(origins[0].params.profile).toBe("Manager");
  });

  test("inherited from a group, named", () => {
    const state = deriveUserCapState(
      sources({ groups: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    const origins = describeCapOrigins(state, { groups: ["Programs", "Staff"] });
    expect(keys(origins)).toEqual([ORIGIN_KEYS.group]);
    expect(origins[0].params.group).toBe("Programs, Staff");
  });

  test("granted directly to this person", () => {
    const state = deriveUserCapState(
      sources({ grants: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    expect(keys(describeCapOrigins(state))).toEqual([ORIGIN_KEYS.direct]);
  });

  test("sources are UNIONED, not ranked: every holding source is reported", () => {
    const state = deriveUserCapState(
      sources({
        profile: { messaging: { send: 1 } },
        grants: { messaging: { send: 1 } },
      }),
      "messaging",
      "send",
    );
    // The personal exception first, then the inherited one — never one alone.
    expect(keys(describeCapOrigins(state, { profileName: "Manager" }))).toEqual([
      ORIGIN_KEYS.direct,
      ORIGIN_KEYS.profile,
    ]);
  });

  test("a block is reported ALONE, even when sources still hold it", () => {
    const state = deriveUserCapState(
      sources({
        profile: { messaging: { send: 1 } },
        grants: { messaging: { send: 1 } },
        restrictions: { messaging: { send: true } },
      }),
      "messaging",
      "send",
    );
    expect(state.effective).toBe(false);
    expect(keys(describeCapOrigins(state))).toEqual([ORIGIN_KEYS.blocked]);
  });

  test("no source is stated as such, never as a silence", () => {
    const state = deriveUserCapState(sources(), "messaging", "send");
    expect(keys(describeCapOrigins(state))).toEqual([ORIGIN_KEYS.none]);
    expect(deriveDenialReason(state)).toBe("no-source");
  });

  test("ineligibility is the outer gate, ahead of a source", () => {
    const state = deriveUserCapState(
      sources({ profile: { messaging: { send: 1 } } }),
      "messaging",
      "send",
      false,
    );
    expect(state.profile).toBe(true);
    expect(state.effective).toBe(false);
    expect(
      keys(describeCapOrigins(state, { profileName: "Manager" })),
    ).toEqual(["engineering.permissions.effectiveReasonNotEligible"]);
  });

  test("a Super Admin's blanket access is not called a profile inheritance", () => {
    const state = deriveUserCapState(
      sources({ profile: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    expect(keys(describeCapOrigins(state, { superAdmin: true }))).toEqual([
      ORIGIN_KEYS.superAdmin,
    ]);
  });

  test("a source with no known name is still named as a source", () => {
    const profile = deriveUserCapState(
      sources({ profile: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    expect(keys(describeCapOrigins(profile))).toEqual([
      ORIGIN_KEYS.profileFallback,
    ]);

    const group = deriveUserCapState(
      sources({ groups: { messaging: { send: 1 } } }),
      "messaging",
      "send",
    );
    expect(keys(describeCapOrigins(group))).toEqual([ORIGIN_KEYS.groupFallback]);
  });

  test("never returns an empty list", () => {
    expect(describeCapOrigins(null).length).toBeGreaterThan(0);
    expect(
      describeCapOrigins(deriveUserCapState(sources(), "x", "y")).length,
    ).toBeGreaterThan(0);
  });

  test("the report agrees with the rule the engine applies", () => {
    // Held: max(profile, group, grant) > 0, eligible, not blocked.
    const held = deriveUserCapState(
      sources({ groups: { projects: { edit: 3 } } }),
      "projects",
      "edit",
    );
    expect(held.effective).toBe(true);
    expect(
      keys(describeCapOrigins(held, { groups: ["Founders"] })),
    ).toEqual([ORIGIN_KEYS.group]);

    // Same sources, blocked: the engine refuses, and so must the report.
    const blocked = deriveUserCapState(
      sources({
        groups: { projects: { edit: 3 } },
        restrictions: { projects: { edit: true } },
      }),
      "projects",
      "edit",
    );
    expect(blocked.effective).toBe(false);
    expect(deriveDenialReason(blocked)).toBe("restriction");
  });
});

// ─── 3. The panel states ────────────────────────────────────────────────────
describe("UI-7 — no state is represented by a blank screen", () => {
  const src = read(EDITOR);

  test("the panel keeps its heading when there is no data yet", () => {
    expect(src).toContain("accessEditorTitle");
    expect(src).toContain("{selectedUser && !userPerms && (");
  });

  test("loading shows a waiting state, not a blank", () => {
    expect(src).toContain("{loadingPerms ? (");
    expect(src).toContain("<Skeleton");
  });

  test("a failure states its reason and offers a retry", () => {
    expect(src).toContain("personAccessLoadFailed");
    expect(src).toContain("{loadError ||");
    expect(src).toContain("onClick={() => selectUser(selectedUser)}");
    expect(src).toContain('t("common.refresh")');
  });

  test("an empty answer says so explicitly", () => {
    expect(src).toContain("personAccessUnavailable");
  });

  test("the section catalogue failure is stated where the rights would be", () => {
    expect(src).toContain("catalogLoadFailed");
    expect(src).toContain("onClick={() => fetchModules()}");
    // The controls built from the catalogue are withheld, not shown empty.
    expect(src).toContain("{!modulesError && (");
  });

  test("the report also states its failure and offers a retry", () => {
    const report = read(REPORT);
    expect(report).toContain("peopleReportLoadFailed");
    expect(report).toContain("onClick={() => selected && pick(selected)}");
  });
});

// ─── 4. One report, two editors ─────────────────────────────────────────────
describe("UI-7 — the report reads, the editors write", () => {
  test("the report is labelled as a report and keeps every origin", () => {
    const src = read(REPORT);
    expect(src).toContain("peopleMatrixReportHint");
    expect(src).toContain("describeCapOrigins");
    expect(src).toContain("originText(state)");
    // The report lists what the catalogue holds for each context module,
    // editable or not: it never narrows itself to what can be changed.
    expect(src).toContain("capsFor(module)");
    expect(src).not.toContain("crudCapabilities");
  });

  test("the exceptions block states the current state next to the actions", () => {
    const src = read(SPECIAL);
    expect(src).toContain("advancedCurrentState");
    expect(src).toContain("advancedGrantDirect");
    expect(src).toContain("advancedRevokeDirect");
    // The ambiguous control is gone: unchecking a box used to mean "block"
    // for an inherited right and "revoke" for a direct one.
    expect(src).not.toContain("onAction?.(\"restrict\", module, capability, 0)},\n");
    expect(src).toContain('onAction?.("restrict", module, capability, 0)');
    expect(src).not.toContain("else onAction");
  });

  test("the four rights state the current situation before the chips", () => {
    expect(read(EDITOR)).toContain("originText(modKey, cap)");
  });

  test("the exceptions block is named for what it does", () => {
    const titleEn = resolveKey(EN, "engineering.permissions.advancedTitle");
    const titleFr = resolveKey(FR, "engineering.permissions.advancedTitle");
    expect(titleEn).not.toBe("Advanced");
    expect(titleFr).not.toBe("Avancé");
    expect(titleFr.toLowerCase()).toContain("exception");
  });
});

// ─── 5. Copy exists in both languages ───────────────────────────────────────
describe("UI-7 — every new string exists in English and French", () => {
  test("the keys the screen introduces are translated", () => {
    const newKeys = [
      "engineering.permissions.peopleMatrixTitle",
      "engineering.permissions.peopleMatrixReportHint",
      "engineering.permissions.peopleReportLoadFailed",
      "engineering.permissions.personAccessLoadFailed",
      "engineering.permissions.personAccessUnavailable",
      "engineering.permissions.catalogLoadFailed",
      "engineering.permissions.advancedTitle",
      "engineering.permissions.advancedHint",
      "engineering.permissions.advancedCurrentState",
      "engineering.permissions.advancedGrantDirect",
      "engineering.permissions.advancedRevokeDirect",
      "engineering.permissions.capOriginDirect",
      "engineering.permissions.capOriginProfile",
      "engineering.permissions.capOriginProfileFallback",
      "engineering.permissions.capOriginGroup",
      "engineering.permissions.capOriginGroupFallback",
      "engineering.permissions.capOriginSuperAdmin",
      "engineering.permissions.capOriginBlocked",
      "engineering.permissions.capOriginNone",
    ];
    for (const key of newKeys) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
    // The origin labels the helper returns must be real copy in both languages.
    for (const key of Object.values(ORIGIN_KEYS)) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});

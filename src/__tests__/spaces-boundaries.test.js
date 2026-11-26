/**
 * Space boundaries — the three spaces and their rules.
 *
 * A space is a place a kind of person works (member, staff, admin); a context
 * is what they are or do inside it (founder, learner, programme manager…).
 * The rules below are the ones that keep the tree readable six months from
 * now, and none of them is visible in the type system:
 *
 *   - an identity belongs to exactly ONE space;
 *   - a space never imports another space;
 *   - a space never talks to the database directly;
 *   - a context lives under its space's address family;
 *   - the entry guard reads the registry instead of a private list.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  SPACES,
  SPACE_KEYS,
  OPERATING_DENIED,
  spaceForRole,
  isOperatingSpace,
  isDeniedInOperatingSpace,
} = require("@/spaces/registry");

const ROOT = path.join(process.cwd(), "src");

/** Every file under a directory, recursively. */
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const read = (file) => fs.readFileSync(file, "utf8");

/** Every import of a space from another space, as `{ file, target }`. */
function crossSpaceImports(spaceKey) {
  const own = path.join(ROOT, "spaces", spaceKey);
  const offenders = [];
  for (const file of walk(own)) {
    if (!/\.(js|jsx)$/.test(file)) continue;
    const source = read(file);
    const matches = source.matchAll(/["']@\/spaces\/(member|staff|admin)\//g);
    for (const match of matches) {
      if (match[1] !== spaceKey) {
        offenders.push({ file: path.relative(ROOT, file), target: match[1] });
      }
    }
  }
  return offenders;
}

describe("the registry — one identity, one space", () => {
  test("every declared identity resolves back to the space that declared it", () => {
    for (const key of SPACE_KEYS) {
      expect(SPACES[key].identities.length).toBeGreaterThan(0);
      for (const identity of SPACES[key].identities) {
        expect(spaceForRole(identity)).toBe(key);
      }
    }
  });

  test("no identity is claimed by two spaces", () => {
    const seen = new Map();
    for (const key of SPACE_KEYS) {
      for (const identity of SPACES[key].identities) {
        expect(seen.has(identity)).toBe(false);
        seen.set(identity, key);
      }
    }
  });

  test("an unknown or empty role belongs to no space", () => {
    expect(spaceForRole("")).toBeNull();
    expect(spaceForRole(null)).toBeNull();
    expect(spaceForRole("not_a_role")).toBeNull();
  });

  test("the three spaces are the only operating/ personal split there is", () => {
    expect(SPACE_KEYS).toEqual(["member", "staff", "admin"]);
    expect(isOperatingSpace("staff")).toBe(true);
    expect(isOperatingSpace("admin")).toBe(true);
    expect(isOperatingSpace("member")).toBe(false);
  });

  test("a platform owner is never denied an operating section", () => {
    expect(isDeniedInOperatingSpace("super_admin")).toBe(false);
  });

  test("the operating denial list is a subset of the member space", () => {
    for (const identity of OPERATING_DENIED) {
      expect(spaceForRole(identity)).toBe("member");
    }
  });
});

describe("the space folders", () => {
  test.each(SPACE_KEYS)("%s is a recognisable folder with its own README", (key) => {
    expect(fs.existsSync(path.join(ROOT, "spaces", key, "README.md"))).toBe(true);
  });

  test.each(SPACE_KEYS)("%s never imports another space", (key) => {
    expect(crossSpaceImports(key)).toEqual([]);
  });

  test.each(SPACE_KEYS)("%s never talks to the database directly", (key) => {
    const offenders = walk(path.join(ROOT, "spaces", key))
      .filter((file) => /\.(js|jsx)$/.test(file))
      .filter((file) => /@\/lib\/db/.test(read(file)))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

describe("the routes follow the spaces", () => {
  test("the staff contexts live under one staff address family", () => {
    for (const context of ["program-manager", "finance", "crm", "create"]) {
      expect(fs.existsSync(path.join(ROOT, "app", "staff", context))).toBe(true);
    }
  });

  test("the old staff addresses are gone — the redirect is the only trace", () => {
    for (const legacy of ["pm", "finance", "crm", "create"]) {
      expect(fs.existsSync(path.join(ROOT, "app", legacy))).toBe(false);
    }
  });

  test("the member contexts live under one member address family", () => {
    for (const context of ["participant", "founder", "investor", "facilitator", "team"]) {
      expect(fs.existsSync(path.join(ROOT, "app", "member", "(contexts)", context))).toBe(true);
    }
    // The hub is the space's chooser screen and stays outside the shell group.
    expect(fs.existsSync(path.join(ROOT, "app", "member", "page.js"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "app", "member", "(contexts)", "layout.js"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "app", "member", "layout.js"))).toBe(false);
  });

  test("the old member addresses are gone — the redirect is the only trace", () => {
    for (const legacy of ["participant", "founder", "investor", "facilitator", "team", "workspaces"]) {
      expect(fs.existsSync(path.join(ROOT, "app", legacy))).toBe(false);
    }
  });

  test("each migrated member context owns its components", () => {
    for (const context of ["investor", "facilitator", "team", "participant"]) {
      expect(fs.existsSync(path.join(ROOT, "spaces", "member", context, "components"))).toBe(true);
    }
  });

  test("a screen only one context shows lives in that context, not in shared", () => {
    const participantOnly = [
      "AssignmentsView.js",
      "ProgramListing.js",
      "ProgramDetail.js",
      "ProgressView.js",
      "RitualsView.js",
      "SubmissionVersionHistory.js",
    ];
    for (const file of participantOnly) {
      expect(
        fs.existsSync(path.join(ROOT, "components", "shared", "dashboard", file)),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(ROOT, "spaces", "member", "participant", "components", file)),
      ).toBe(true);
    }

    for (const [file, context] of [
      ["StandupRetroView.js", path.join("staff", "core")],
      ["UnifiedDashboard.js", path.join("staff", "program-manager")],
    ]) {
      expect(
        fs.existsSync(path.join(ROOT, "components", "shared", "dashboard", file)),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(ROOT, "spaces", context, "components", file)),
      ).toBe(true);
    }
  });

  test("the dead founder overview is gone", () => {
    expect(
      fs.existsSync(
        path.join(ROOT, "components", "shared", "dashboard", "FounderDashboardOverview.js"),
      ),
    ).toBe(false);
  });

  test("the admin components live in the admin space", () => {
    for (const domain of ["components", "finance", "permissions"]) {
      expect(fs.existsSync(path.join(ROOT, "spaces", "admin", domain))).toBe(true);
    }
    for (const gone of ["admin", "finance", "permissions"]) {
      expect(fs.existsSync(path.join(ROOT, "components", gone))).toBe(false);
    }
  });

  test("a context moved under an existing space does not mount a second shell", () => {
    const layouts = [
      path.join(ROOT, "app", "staff", "program-manager", "layout.js"),
      path.join(ROOT, "app", "staff", "finance", "layout.js"),
      path.join(ROOT, "app", "staff", "crm", "layout.js"),
      path.join(ROOT, "app", "staff", "create", "layout.js"),
      path.join(ROOT, "app", "member", "(contexts)", "participant", "layout.js"),
      path.join(ROOT, "app", "member", "(contexts)", "founder", "layout.js"),
      path.join(ROOT, "app", "member", "(contexts)", "facilitator", "layout.js"),
    ];
    for (const layout of layouts) {
      if (!fs.existsSync(layout)) continue;
      expect(read(layout)).not.toContain("DashboardLayout");
    }
  });

  test("each space mounts its shell exactly once, in the space layout", () => {
    expect(read(path.join(ROOT, "app", "staff", "layout.js"))).toContain("DashboardLayout");
    expect(read(path.join(ROOT, "app", "member", "(contexts)", "layout.js"))).toContain(
      "DashboardLayout",
    );
    expect(read(path.join(ROOT, "app", "admin", "layout.js"))).toContain("DashboardLayout");
  });
});

describe("the shared layer", () => {
  test("shared components never depend on a space", () => {
    const offenders = walk(path.join(ROOT, "components", "shared"))
      .filter((file) => /\.(js|jsx)$/.test(file))
      .filter((file) => /@\/spaces\/(member|staff|admin)/.test(read(file)))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  test("a component two spaces need is not kept inside one of them", () => {
    // The staff kit is used by the admin dashboard too; the CRM console by the
    // admin CRM screens. A copy under a space folder would drift.
    for (const shared of [
      "calendar",
      "crm",
      "dashboard",
      "integrations",
      "membership",
      "platform",
      "public",
      "ventures",
    ]) {
      expect(fs.existsSync(path.join(ROOT, "components", "shared", shared))).toBe(true);
    }
    for (const gone of ["investor", "facilitator", "team"]) {
      expect(fs.existsSync(path.join(ROOT, "components", gone))).toBe(false);
    }
  });
});

describe("the entry guard reads the registry", () => {
  test("SectionRoleGuard keeps no private identity list", () => {
    const guard = read(path.join(ROOT, "components", "layout", "SectionRoleGuard.js"));
    expect(guard).toContain("@/spaces/registry");
    expect(guard).not.toContain("PERSONAL_IDENTITIES");
  });

  test("the admin entry guard reads the registry, not a role label", () => {
    const layout = read(path.join(ROOT, "app", "admin", "layout.js"));
    expect(layout).toContain("@/spaces/registry");
    // No second identity → space table, and no owner test of its own.
    expect(layout).not.toContain("redirectMap");
    expect(layout).not.toContain("isPlatformOwnerRole");
  });

  test("the navigation admin gate asks the registry, not the role name", () => {
    const builders = read(path.join(ROOT, "lib", "masterNavigation", "builders.js"));
    expect(builders).toContain('spaceForRole(role) === "admin"');
    expect(builders).not.toContain('role === "super_admin"');
  });
});

describe("the platform space follows rights, not a role table", () => {
  const { default: modules, getActiveModules } = require("@/models/platform/registry");

  test("every module names the right its API enforces", () => {
    for (const entry of modules) {
      expect(entry.capability).toBeTruthy();
      expect(typeof entry.capability.module).toBe("string");
      expect(typeof entry.capability.capability).toBe("string");
    }
  });

  test("a module appears only when its right is held", () => {
    const holds = (...owned) => ({ module: moduleKey, capability }) =>
      owned.includes(`${moduleKey}.${capability}`);
    const ids = (list) => list.map((entry) => entry.id);

    expect(ids(getActiveModules("super_admin", holds("runs.view")))).toEqual([
      "platform-dashboard",
      "platform-runs",
      "platform-scores",
    ]);
    expect(ids(getActiveModules("staff", holds("forms.view")))).toEqual([
      "platform-forms",
    ]);
    // The staff default profile holds none of the platform rights: no door.
    expect(getActiveModules("staff", holds())).toEqual([]);
    // A module without a right is never offered through the predicate path.
    expect(getActiveModules("super_admin", () => false)).toEqual([]);
  });

  test("the role table survives only for the catalogue screens", () => {
    const registry = read(path.join(ROOT, "models", "platform", "registry.js"));
    expect(registry).toContain("module.permissions.includes(role)");
    expect(registry).toContain("No predicate: a catalogue screen asks the legacy role table");
  });
});

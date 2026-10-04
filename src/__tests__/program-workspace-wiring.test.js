/**
 * The PM program workspace wiring.
 *
 * The screen (src/app/pm/programs/[id]/page.js) keeps every state value and every
 * data read; its writes live in ./actions/ (one factory per concern) and its
 * markup in `WorkspaceContent` / `WorkspaceModals`. Those blocks read the page's
 * values through two objects the page builds by hand: `values` (state, setters,
 * reads) and `ctx` (`values` + every handler).
 *
 * Nothing in the type system connects those three sides, and no behavioural test
 * renders the screen, so a name that no longer reaches a block is invisible: the
 * factory receives `undefined`, or the component reads a value that is not there.
 * ESLint cannot see it either — every name is declared somewhere. So this suite
 * pins the wiring itself: each action module's parameters must be keys of
 * `values`, and each view block's names must resolve to a value or to a handler
 * one of the modules returns.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PAGE = path.join(
  ROOT,
  "app",
  "pm",
  "programs",
  "[id]",
  "page.js",
);
const ACTIONS_DIR = path.join(
  ROOT,
  "app",
  "pm",
  "programs",
  "[id]",
  "actions",
);
const WORKSPACE_DIR = path.join(
  ROOT,
  "components",
  "pm",
  "program-workspace",
);
const BLOCKS = ["WorkspaceContent.js", "WorkspaceModals.js"];

const read = (file) => fs.readFileSync(file, "utf8");

/** The keys of one page object literal, from its declaration marker to the end. */
function objectKeys(page, marker) {
  const block = page.split(marker)[1];
  if (!block) return [];
  return block
    .split("\n}")
    .join("\n")
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => /^[A-Za-z_$][\w$]*$/.test(line));
}

/**
 * The names a view block may read that the page hands over through `ctx` but not
 * through the action factories: the config refs (kept apart because
 * react-hooks/refs forbids a ref reaching a function during render) and
 * `saveConfig` (their only reader, a handler that stays on the page).
 */
function viewExtras(page) {
  return [...objectKeys(page, "const configRefs = {"), "saveConfig"];
}

/**
 * The names a view block may read: the page's `values` object plus the extras
 * it slices into `ctx` (`configRefs` and `saveConfig`).
 */
function valueKeys() {
  const page = read(PAGE);
  const keys = objectKeys(page, "const values = {");
  if (keys.length === 0) throw new Error("the page no longer builds a `values` object");
  return new Set([...keys, ...viewExtras(page)]);
}

/** The names one action module destructures from `values`. */
function actionParams(file) {
  const src = read(file);
  const signature = src.split("}) {")[0];
  if (!signature) throw new Error(`${path.basename(file)} has no signature`);
  return [...signature.matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map(
    (m) => m[1],
  );
}

/** The names one view block destructures from `ctx`. */
function blockNames(file) {
  const src = read(file);
  const block = src.split("} = ctx;")[0];
  if (!block) throw new Error(`${path.basename(file)} no longer reads ctx`);
  return [...block.matchAll(/^ {4}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]);
}

/** The handlers one action module returns. */
function actionReturns(file) {
  const src = read(file);
  const returned = src.split("  return {").pop();
  if (!returned) throw new Error(`${path.basename(file)} returns nothing`);
  return [...returned.matchAll(/^ {4}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]);
}

const actionFiles = fs
  .readdirSync(ACTIONS_DIR)
  .filter((name) => name.endsWith(".js"))
  .sort();

describe("the PM program workspace wiring", () => {
  const values = valueKeys();

  test("every action module reads only what the page puts in `values`", () => {
    const orphans = [];
    for (const name of actionFiles) {
      for (const param of actionParams(path.join(ACTIONS_DIR, name))) {
        if (!values.has(param)) orphans.push(`${name}: ${param}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("every view block reads a value or a returned handler", () => {
    const handlers = new Set();
    for (const name of actionFiles) {
      for (const handler of actionReturns(path.join(ACTIONS_DIR, name))) {
        handlers.add(handler);
      }
    }
    const orphans = [];
    for (const name of BLOCKS) {
      for (const key of blockNames(path.join(WORKSPACE_DIR, name))) {
        if (!values.has(key) && !handlers.has(key)) {
          orphans.push(`${name}: ${key}`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  test("the two objects are both built: `values` first, then `ctx`", () => {
    const page = read(PAGE);
    expect(page.indexOf("const values = {")).toBeGreaterThan(-1);
    expect(page.indexOf("const ctx = {")).toBeGreaterThan(
      page.indexOf("const values = {"),
    );
    // `ctx` must spread the handlers before the values, so a name shared by a
    // factory's return and a state value still resolves to the handler.
    const ctx = page.split("const ctx = {")[1].split("};")[0];
    expect(ctx).toMatch(/\.\.\.\w+Handlers,\n\s*\.\.\.values,/);
  });
});

describe("the PM weekly-report modal wiring", () => {
  const SECTIONS = [
    "PmReportOverviewSection.js",
    "PmReportAssignmentSection.js",
    "PmReportParticipationSection.js",
    "PmReportDeliverySection.js",
    "PmReportIssuesSection.js",
    "PmReportNextWeekSection.js",
    "PmReportNotesSection.js",
  ];

  // the props `WorkspaceModals` hands to `<PmReportModal>`: they become its `ctx`
  const provided = (() => {
    const src = read(path.join(WORKSPACE_DIR, "WorkspaceModals.js"));
    const from = src.indexOf("<PmReportModal");
    const tag = src.slice(from, src.indexOf("/>", from));
    return new Set([...tag.matchAll(/([A-Za-z_$][\w$]*)=\{/g)].map((m) => m[1]));
  })();

  const ctxKeys = (src) => {
    const match = src.match(/const \{([^}]*)\} = ctx;/);
    return match
      ? match[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  };

  test("every report section reads a prop `WorkspaceModals` passes", () => {
    const orphans = [];
    for (const file of SECTIONS) {
      const src = read(path.join(WORKSPACE_DIR, file));
      for (const key of ctxKeys(src)) {
        if (!provided.has(key)) orphans.push(`${file}: ${key}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("PmReportModal forwards its props to every section", () => {
    const src = read(path.join(WORKSPACE_DIR, "PmReportModal.js"));
    for (const part of SECTIONS.map((n) => n.replace(".js", ""))) {
      expect(src).toContain(`<${part} ctx={props} />`);
    }
  });
});
/**
 * The staff operational report wiring.
 *
 * The screen (src/app/staff/op-report/page.js) keeps every state value and
 * every read; its writes live in ./actions (one factory per concern), the
 * useCallback handlers that must stay memoised live in ./useOpReportNav, the
 * module-scope readers live in ./readers, and the markup lives in two blocks
 * under components/staff/op-report. Nothing at the type level ties those sides
 * together and no behavioural test renders this screen, so a name that stops
 * reaching a factory or a block is invisible: the factory reads `undefined`, or
 * a block reads a field that is not there. ESLint cannot see it either — every
 * name is declared somewhere.
 *
 * So this suite pins the wiring: every factory's parameters must be keys of
 * `values` or names an earlier factory returns; every name a block reads must
 * be a value or a handler; the spreads of `ctx` must cover every factory; and
 * `values` must be free of names nobody reads — including refs, which the React
 * compiler refuses to see reach a function during render.
 */

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "app", "staff", "op-report");
const PAGE = path.join(SRC, "page.js");
const ACTIONS = path.join(SRC, "actions");
const BLOCKS_DIR = path.join(ROOT, "components", "staff", "op-report");
const BLOCKS = ["ReportContent.js", "OpReportModals.js"];

const read = (file) => fs.readFileSync(file, "utf8");
const names = (src, re, from) => {
  const part = from ? src.split(from)[0] : src;
  return [...part.matchAll(re)].map((m) => m[1]);
};
/** The keys of an object literal, or the names of a `const { … }`, four-space indented. */
function listed(src, close) {
  const before = src.split(close)[0];
  const start = Math.max(before.lastIndexOf("const {"), before.lastIndexOf("= {"));
  if (start === -1) throw new Error(`no list before ${close}`);
  return names(before.slice(start), /^ {4}([A-Za-z_$][\w$]*),$/gm);
}

const page = read(PAGE);
const valueKeys = listed(page.slice(page.indexOf("const values = {")), "\n  };");
const valueSet = new Set(valueKeys);

const actionFiles = fs.readdirSync(ACTIONS).filter((n) => n.endsWith(".js")).sort();

const factories = new Map();
const returnedHandlers = new Set();
for (const file of actionFiles) {
  const src = read(path.join(ACTIONS, file));
  factories.set(file, {
    factory: src.match(/export function (\w+)\(/)[1],
    // the signature, not the imports above it
    params: [...src.match(/export function \w+\(\{([\s\S]*?)\}\) \{/)[1].matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]),
  });
  // what it returns, plus what it defines for itself: a split helper is reachable
  for (const n of names(src, /^ {4}([A-Za-z_$][\w$]*),$/gm, "  return {")) returnedHandlers.add(n);
  for (const n of names(src, /^ {2}const ([A-Za-z_$][\w$]*) = /gm, null)) returnedHandlers.add(n);
}

const hookSource = read(path.join(SRC, "useOpReportNav.js"));
const hookNames = names(hookSource.slice(hookSource.indexOf("  return {")), /^ {4}([A-Za-z_$][\w$]*),$/gm);
const returnedBy = new Map();
for (const [file, { factory }] of factories) {
  const src = read(path.join(ACTIONS, file));
  // a returned handler, and a helper it defines for itself: both reach the next factory
  for (const n of names(src, /^ {4}([A-Za-z_$][\w$]*),$/gm, "  return {")) returnedBy.set(n, factory);
  for (const n of names(src, /^ {2}const ([A-Za-z_$][\w$]*) = /gm, null)) returnedBy.set(n, factory);
}

const blockProps = new Map(
  BLOCKS.map((file) => [file, listed(read(path.join(BLOCKS_DIR, file)), "} = ctx;")]),
);

describe("the staff operational report wiring", () => {
  test("every factory reads only what the page hands it", () => {
    const orphans = [];
    for (const [file, { params }] of factories) {
      for (const param of params) {
        // a value, a handler an earlier factory returns, or a name the nav hook
        // already destructured in the page
        if (valueSet.has(param)) continue;
        if (returnedHandlers.has(param)) continue;
        if (hookNames.includes(param)) continue;
        orphans.push(`${file}: ${param}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("every block reads a value or a returned handler", () => {
    const orphans = [];
    for (const file of BLOCKS) {
      for (const key of blockProps.get(file)) {
        if (!valueSet.has(key) && !returnedHandlers.has(key)) orphans.push(`${file}: ${key}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("`ctx` carries every handler and then the values", () => {
    const ctx = page.slice(page.indexOf("const ctx = {")).split("\n  };")[0];
    for (const { factory } of factories.values()) expect(ctx).toContain(`...${factory}Result,`);
    expect(ctx.trim().endsWith("...values,")).toBe(true);
    // the header's own handlers are plain names, never smuggled through ctx twice
    expect(page).toContain("const { navigateWeek } = weekActionsResult;");
  });

  test("`values` holds nothing nobody reads — no ref, no orphan", () => {
    const read = new Set([...valueSet, ...returnedHandlers, ...hookNames, ...blockProps.values()].flat());
    const orphans = valueKeys.filter((name) => !read.has(name));
    expect(orphans).toEqual([]);
    // draftTimerRef stays on the page: it reaches an effect, not a factory
    expect(valueSet.has("draftTimerRef")).toBe(false);
  });

  test("each factory's call passes what its signature asks for", () => {
    for (const [, { factory, params }] of factories) {
      const call = page.match(new RegExp(`const ${factory}Result = ${factory}\\(([^;]*)\\);`));
      expect(call).not.toBeNull();
      const argument = call[1];
      for (const param of params) {
        const owner = returnedBy.get(param);
        if (!owner) continue; // a `values` key, or a hook name from the page
        expect({ factory, param, spread: argument.includes(`...${owner}Result`) }).toEqual({
          factory,
          param,
          spread: true,
        });
      }
    }
  });
});
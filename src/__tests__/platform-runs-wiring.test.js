/**
 * The platform runs screen wiring.
 *
 * The page (src/app/platform/runs/page.js) keeps every state value and every
 * data read; its writes live in ./actions (one factory per concern) and its
 * markup in four blocks under components/platform/runs. Nothing at the type
 * level connects those three sides, and no behavioural test renders this screen,
 * so a name that stops reaching a block is invisible: a factory reads
 * `undefined`, or a block reads a value that is not there. ESLint cannot see it
 * either — every name is declared somewhere.
 *
 * So this suite pins the wiring itself: every action factory's parameters must be
 * keys of `values`; every name a block reads from `ctx` must be a value or a
 * returned handler; the refs and the two handlers that read them must stay
 * explicit props, never smuggled through the objects (the React compiler refuses
 * a ref reaching a function during render); and every key of `values` must be a
 * name the page really declares.
 */

const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");

const ROOT = path.join(__dirname, "..");
const PAGE = path.join(ROOT, "app", "platform", "runs", "page.js");
const ACTIONS_DIR = path.join(ROOT, "app", "platform", "runs", "actions");
const BLOCKS_DIR = path.join(ROOT, "components", "platform", "runs");
const BLOCKS = ["RunResponsesPanel.js", "RunAdminTabs.js", "RunDetailModals.js", "RunListView.js", "RunDetailView.js"];

// the refs, and the two abortable batch loops that read them: handed over as
// plain props, because `values` and `ctx` reach functions during render
const EXPLICIT = ["filterRowRef", "bulkAbortRef", "retryAbortRef", "runBulkApprove", "runRetryEmails"];

const read = (file) => fs.readFileSync(file, "utf8");
const names = (src, re, from) => {
  const part = from ? src.split(from)[0] : src;
  return [...part.matchAll(re)].map((m) => m[1]);
};

/** The names one function's body declares. */
function declaredNames(src, fnName) {
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "FunctionDeclaration" && node.id && node.id.name === fnName) {
      for (const stmt of node.body.body) {
        if (stmt.type !== "VariableDeclaration") continue;
        for (const decl of stmt.declarations) {
          if (decl.id.type === "Identifier") found.push(decl.id.name);
          else if (decl.id.type === "ArrayPattern") {
            for (const el of decl.id.elements) if (el && el.type === "Identifier") found.push(el.name);
          } else if (decl.id.type === "ObjectPattern") {
            for (const prop of decl.id.properties) {
              const target = prop.type === "RestElement" ? prop.argument : prop.value;
              if (target && target.type === "Identifier") found.push(target.name);
            }
          }
        }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      walk(node[key]);
    }
  };
  walk(ast.program);
  return found;
}

const page = read(PAGE);

/** The keys of an object literal or the names of a `const { ... }`, four-space indented. */
function destructured(src, close) {
  const before = src.split(close)[0];
  const start = Math.max(before.lastIndexOf("const {"), before.lastIndexOf("= {"));
  if (start === -1) throw new Error(`no block before ${close}`);
  return names(before.slice(start), /^ {4}([A-Za-z_$][\w$]*),$/gm);
}

const valueKeys = destructured(page.slice(page.indexOf("const values = {")), "\n  };");
const valueSet = new Set(valueKeys);

const factories = new Map();
const returnedHandlers = new Set();
for (const file of fs.readdirSync(ACTIONS_DIR).filter((n) => n.endsWith(".js")).sort()) {
  const src = read(path.join(ACTIONS_DIR, file));
  const factory = src.match(/export function (\w+)\(/)[1];
  factories.set(file, { factory, params: names(src, /^ {2}([A-Za-z_$][\w$]*),$/gm, "}) {") });
  // what it returns, plus what it defines for itself: a split helper is reachable
  for (const n of names(src, /^ {4}([A-Za-z_$][\w$]*),$/gm, "  return {")) returnedHandlers.add(n);
  for (const n of names(src, /^ {2}const ([A-Za-z_$][\w$]*) = /gm, null)) returnedHandlers.add(n);
}

const blockProps = new Map(
  BLOCKS.map((file) => {
    const src = read(path.join(BLOCKS_DIR, file));
    const signature = src.match(/export default function \w+\(\{([^}]*)\}\)/);
    const props = signature
      ? signature[1].split(",").map((s) => s.trim()).filter((n) => n && n !== "ctx")
      : [];
    return [file, props];
  }),
);

describe("the platform runs screen wiring", () => {
  test("every action factory reads only what the page puts in `values`", () => {
    const orphans = [];
    for (const [file, { params }] of factories) {
      for (const param of params) {
        if (valueSet.has(param)) continue;
        if (EXPLICIT.includes(param)) continue; // reaches the blocks as a plain prop
        orphans.push(`${file}: ${param}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("every block reads a value or a returned handler", () => {
    const orphans = [];
    for (const file of BLOCKS) {
      const src = read(path.join(BLOCKS_DIR, file));
      for (const key of destructured(src, "} = ctx;")) {
        if (!valueSet.has(key) && !returnedHandlers.has(key)) orphans.push(`${file}: ${key}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("the refs and the handlers that read them stay explicit props", () => {
    for (const name of EXPLICIT) expect(valueSet.has(name)).toBe(false);
    for (const [file, props] of blockProps) {
      for (const prop of props) {
        expect({ file, prop, inList: EXPLICIT.includes(prop) }).toEqual({ file, prop, inList: true });
      }
    }
    for (const name of EXPLICIT) {
      const usedByABlock = BLOCKS.some((file) => blockProps.get(file).includes(name));
      if (!usedByABlock) continue;
      expect(page).toMatch(new RegExp(`${name}=\\{${name}\\}`));
    }
  });

  test("`ctx` is every handler plus the values, handlers first", () => {
    const ctx = page.slice(page.indexOf("const ctx = {")).split("\n  };")[0];
    for (const { factory } of factories.values()) expect(ctx).toContain(`...${factory}Result,`);
    expect(ctx.trim().endsWith("...values,")).toBe(true);
  });

  test("every key of `values` is a name the page really declares", () => {
    const declared = new Set(declaredNames(page, "FormRunsPage"));
    expect(valueKeys.filter((name) => !declared.has(name))).toEqual([]);
  });
});
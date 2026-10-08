/**
 * The journey panel wiring.
 *
 * The panel (src/components/ventures/JourneyManagerPanel.js) keeps every state
 * value, every read and the composition; its writes live in
 * journey/actions (one factory per concern) and the two large markup blocks in
 * journey/. Nothing at the type level ties those sides together and no
 * behavioural test renders this panel, so a name that stops reaching a factory
 * or a block is invisible: the factory reads `undefined` — a write posts to the
 * wrong journey — or a block reads a field that is not there. ESLint cannot see
 * it either: every name is declared somewhere.
 *
 * So this suite pins the wiring in both directions: every factory's parameters
 * must be keys of `values` or names an earlier factory returns, and the panel's
 * call must hand over the spread that carries them; every name a block reads
 * must be a value or a returned handler; the spreads of `ctx` must cover every
 * factory; and `values` must be free of names nobody reads — including a handler
 * name, which would shadow what the factory returned.
 */

const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");
const ROOT = path.join(__dirname, "..");
const VENTURES = path.join(ROOT, "components", "ventures");
const PANEL = path.join(VENTURES, "JourneyManagerPanel.js");
const ACTIONS = path.join(VENTURES, "journey", "actions");
const JOURNEY = path.join(VENTURES, "journey");
const BLOCKS = ["JourneyManagerModals.js", "JourneyStageList.js"];

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

/** Every name a binding pattern introduces: `a`, `[a, b]`, `{ a, b: c }`, `a = 1`. */
function boundNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === "Identifier") return [pattern.name];
  if (pattern.type === "AssignmentPattern") return boundNames(pattern.left);
  if (pattern.type === "RestElement") return boundNames(pattern.argument);
  if (pattern.type === "ArrayPattern") return pattern.elements.flatMap((e) => boundNames(e));
  if (pattern.type === "ObjectPattern") return pattern.properties.flatMap((p) => boundNames(p.type === "RestElement" ? p.argument : p.value));
  return [];
}

/** The names a component body declares: every useState pair, read and helper. */
function declaredNames(src, fnName) {
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (
      node.type === "FunctionDeclaration" && node.id?.name === fnName ||
      node.type === "ExportDefaultDeclaration" && node.declaration?.id?.name === fnName
    ) {
      for (const stmt of [node.declaration || node].flatMap((fn) => fn.body.body)) {
        if (stmt.type !== "VariableDeclaration") continue;
        for (const decl of stmt.declarations) found.push(...boundNames(decl.id));
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

/** What a component reads without declaring it: the markup's own free names. */
function freeNames(src, fnName) {
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  const walk = (node, visit, parent = null) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, visit, parent));
    if (node.type) visit(node, parent);
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      walk(node[key], visit, node);
    }
  };
  let fn = null;
  walk(ast.program, (node) => {
    if ((node.type === "FunctionDeclaration" || node.type === "ExportDefaultDeclaration") && node.id?.name === fnName) fn = node;
    if (node.type === "ExportDefaultDeclaration" && node.declaration?.id?.name === fnName) fn = node.declaration;
  });
  if (!fn) throw new Error(`no component ${fnName} in the file`);

  const provided = new Set(boundNames(fn.params[0]));   // what the signature hands it
  const local = new Set(provided);                       // what it declares for itself
  const read = new Set();
  walk(fn.body, (node, parent) => {
    if (node.type === "Identifier") {
      const memberProp = parent && /^(Optional)?MemberExpression$/.test(parent.type) && parent.property === node && !parent.computed;
      const objectKey = parent && parent.type === "ObjectProperty" && parent.key === node && !parent.computed && !parent.shorthand;
      const attributeName = parent && parent.type === "JSXAttribute" && parent.name === node;
      const tagName = parent && /^JSX(Opening|Closing|SelfClosing)Element$/.test(parent.type) && parent.name === node;
      if (!memberProp && !objectKey && !attributeName && !tagName) read.add(node.name);
      return;
    }
    if (node.type === "VariableDeclarator") boundNames(node.id).forEach((n) => local.add(n));
    if (/Function(Expression|Declaration)$/.test(node.type)) {
      // a parameter of any function below binds a name, including `({ kind, step })`
      if (node.params) node.params.forEach((param) => boundNames(param).forEach((n) => local.add(n)));
      if (node.id?.name) local.add(node.id.name);
    }
    if (node.type === "CatchClause" && node.param) boundNames(node.param).forEach((n) => local.add(n));
  });
  // `const { … } = ctx` re-binds what the signature already provides
  walk(fn.body, (node) => {
    if (node.type === "VariableDeclarator") boundNames(node.id).forEach((n) => local.add(n));
  });
  return [...read].filter((name) => !local.has(name));
}

const GLOBALS = /^(fetch|console|JSON|String|Number|Boolean|Math|Date|setTimeout|clearTimeout|setInterval|clearInterval|URL|FormData|Blob|File|Error|Promise|Map|Set|Array|Object|RegExp|isNaN|parseInt|parseFloat|encodeURIComponent|decodeURIComponent|Response|Request|Headers|Intl|length|undefined|null|true|false)$/;

const panel = read(PANEL);
const valueKeys = listed(panel.slice(panel.indexOf("const values = {")), "\n  };");
const valueSet = new Set(valueKeys);

const actionFiles = fs.readdirSync(ACTIONS).filter((n) => n.endsWith(".js")).sort();

/** The names a factory returns: the object literal of its last statement. */
function returnedNames(src) {
  const after = src.slice(src.lastIndexOf("\n  return {"));
  return names(after.slice(0, after.indexOf("\n  };")), /^ {4}([A-Za-z_$][\w$]*),$/gm);
}

const factories = new Map();
const returnedHandlers = new Set();
const returnedBy = new Map();
for (const file of actionFiles) {
  const src = read(path.join(ACTIONS, file));
  const factory = src.match(/export function (\w+)\(/)[1];
  // the signature, not the imports above it
  const params = [...src.match(/export function \w+\(\{([\s\S]*?)\}\) \{/)[1].matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]);
  factories.set(file, { factory, params });
  for (const n of returnedNames(src)) {
    returnedHandlers.add(n);
    returnedBy.set(n, factory);
  }
}

const blockProps = new Map(
  BLOCKS.map((file) => [file, listed(read(path.join(JOURNEY, file)), "} = ctx;")]),
);

describe("the journey panel wiring", () => {
  test("every factory reads only what the panel hands it", () => {
    const orphans = [];
    for (const [file, { params }] of factories) {
      for (const param of params) {
        // a value of the panel, or a handler an earlier factory returns
        if (valueSet.has(param) || returnedHandlers.has(param)) continue;
        orphans.push(`${file}: ${param}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("each factory's call passes what its signature asks for", () => {
    for (const [, { factory, params }] of factories) {
      const call = panel.match(new RegExp(`const ${factory}Result = ${factory}\\(([\\s\\S]*?)\\);`));
      expect(call).not.toBeNull();
      const argument = call[1];
      for (const param of params) {
        const owner = returnedBy.get(param);
        if (!owner) continue; // a `values` key
        expect({ factory, param, spread: argument.includes(`...${owner}Result`) }).toEqual({
          factory,
          param,
          spread: true,
        });
      }
    }
  });

  test("every block reads a value or a returned handler", () => {
    const orphans = [];
    for (const file of BLOCKS) {
      for (const prop of blockProps.get(file)) {
        if (!valueSet.has(prop) && !returnedHandlers.has(prop)) orphans.push(`${file}: ${prop}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("`ctx` carries every handler and then the values", () => {
    const ctx = panel.slice(panel.indexOf("const ctx = {")).split("\n  };")[0];
    for (const { factory } of factories.values()) expect(ctx).toContain(`...${factory}Result,`);
    // the values come last: a name that is both must stay the handler
    expect(ctx.trim().endsWith("...values,")).toBe(true);
  });

  test("`values` holds nothing nobody reads — and no handler, which would shadow it", () => {
    const read = new Set([
      ...valueSet,
      ...returnedHandlers,
      ...factories.values(),
      ...blockProps.values(),
    ].flat());
    const orphans = valueKeys.filter((name) => !read.has(name));
    expect(orphans).toEqual([]);
    // a factory name in `values` would be shadowed by its own result
    const shadowed = valueKeys.filter((name) => returnedHandlers.has(name));
    expect(shadowed).toEqual([]);
  });

  test("a block reads exactly what its signature lists — nothing left out", () => {
    const problems = [];
    for (const file of BLOCKS) {
      const src = read(path.join(JOURNEY, file));
      const listedHere = new Set(blockProps.get(file));
      const imported = new Set(
        [...src.matchAll(/^import (?:(\w+)|\{([^}]*)\})/gm)]
          .flatMap((m) => [m[1], ...(m[2] || "").split(",").map((n) => n.trim())])
          .filter(Boolean),
      );
      const component = file.replace(/\.js$/, "");
      for (const name of freeNames(src, component)) {
        if (listedHere.has(name) || imported.has(name) || GLOBALS.test(name)) continue;
        problems.push(`${file}: reads ${name}, which its signature does not list`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every key of `values` is a name the panel really declares", () => {
    const declared = new Set([...declaredNames(panel, "JourneyManagerPanel"), "ventureId"]);
    expect(valueKeys.filter((name) => !declared.has(name))).toEqual([]);
  });

  test("`ctx` is every handler plus the values, handlers first", () => {
    const ctx = panel.slice(panel.indexOf("const ctx = {")).split("\n  };")[0];
    // a values key that is also a returned handler would be shadowed the other way
    expect(ctx.split("\n")[1].trim()).toMatch(/^\.\.\.\w+Result,$/);
  });

  test("the panel keeps its own parameter, its reads and its composition", () => {
    // `ventureId` is the panel's parameter: every write builds its URL from it
    expect(valueSet.has("ventureId")).toBe(true);
    // the reads stay in the panel, never in a factory
    for (const file of actionFiles) {
      const src = read(path.join(ACTIONS, file));
      expect(src).not.toMatch(/useState|useApi|useI18n|useDialogs/);
    }
    // the panel is what renders the blocks
    expect(panel).toContain("<JourneyStageList ctx={ctx} />");
    expect(panel).toContain("<JourneyManagerModals ctx={ctx} />");
  });
});
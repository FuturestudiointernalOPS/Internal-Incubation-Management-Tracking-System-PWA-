/**
 * The access-profile editor wiring.
 *
 * AccessProfilesView.js keeps every state value, every read, both loaders, the
 * three effects, the early return and the composition; its writes live in
 * profiles/actions (one factory per concern) and the five markup islands in
 * profiles/. Nothing at the type level ties those sides together and no
 * behavioural test renders this screen, so a name that stops reaching a factory
 * or a block is invisible: the factory reads `undefined` — a write posts the
 * wrong profile id — or a block reads a field that is not there. ESLint cannot
 * see it either: every name is declared somewhere.
 *
 * So this suite pins the wiring in both directions: every factory's parameters
 * must be something the panel declares, a key of `values`, or a name an earlier
 * factory returns; the panel's call must hand each of them over; every prop a
 * block lists must be a key of `ctx`; the spreads of `ctx` must be the factory
 * results in call order; and `values` must hold nothing nobody reads — including
 * a handler name, which would shadow what the factory returned.
 *
 * The order matters as much as the membership. `values` names 61 of the names the
 * factories read, but the two the monolith computed after `if (loading)` stay
 * after it, so they cannot be keys of `values`: naming them there reads them in
 * the temporal dead zone, and a ReferenceError on the first render. They travel
 * on `ctx`, and the one factory that needs one is called after them.
 */

const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");

const ROOT = path.join(__dirname, "..");
const PERMISSIONS = path.join(ROOT, "components", "permissions");
const PANEL = path.join(PERMISSIONS, "permission-center", "AccessProfilesView.js");
const PROFILES = path.join(PERMISSIONS, "permission-center", "profiles");
const ACTIONS = path.join(PROFILES, "actions");
const BLOCKS = [
  "ProfileNotices.js",
  "ProfileDialogs.js",
  "ProfileCreateForm.js",
  "ProfilePicker.js",
  "ProfileDetail.js",
];

const read = (file) => fs.readFileSync(file, "utf8");
const parse = (src) => parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
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

const panel = read(PANEL);
const panelAst = parse(panel);
const component = panelAst.program.body.find((n) => n.type === "ExportDefaultDeclaration").declaration;
const body = component.body.body;

/** Every name the component body declares: every useState pair, read and helper. */
function declaredNames(src, fnName) {
  const ast = parse(src);
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
  const ast = parse(src);
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

const valueKeys = listed(panel.slice(panel.indexOf("const values = {")), "\n  };");
const valueSet = new Set(valueKeys);
/** `ctx` carries the handler spreads plus the names the panel computes itself. */
const ctxKeys = listed(panel.slice(panel.indexOf("const ctx = {")), "\n  };");
const ctxSpreads = names(panel.slice(panel.indexOf("const ctx = {")).split("\n  };")[0], /^ {4}(\.\.\.\w+),$/gm);

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

/** The keys an object literal hands over, spread names aside. */
function handedOver(src, after) {
  const block = src.slice(src.indexOf(after)).split("});")[0];
  return block.replace(/^ {2}\.\.\.\w+,$/gm, "").matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm);
}

/** The handlers the panel names itself, destructured out of a factory's result. */
const ownFromResult = body
  .flatMap((stmt) => (stmt.type === "VariableDeclaration" ? stmt.declarations : []))
  .filter((decl) => decl.init?.type === "Identifier" && /Result$/.test(decl.init.name))
  .flatMap((decl) => boundNames(decl.id));

/** The factories as the panel calls them, in order. */
const callOrder = [...panel.matchAll(/const (\w+)Result = \w+\(/g)].map((m) => m[1]);

const blockProps = new Map(
  BLOCKS.map((file) => [file, listed(read(path.join(PROFILES, file)), "} = ctx;")]),
);

/** The panel's top-level statements, so an order can be asserted by index. */
const statementIndex = (predicate) => body.findIndex(predicate);

describe("the access-profile editor wiring", () => {
  test("every factory reads only what the panel declares, `values` carries, or an earlier factory returns", () => {
    const declared = new Set([...declaredNames(panel, "AccessProfilesView"), "initialProfileId"]);
    const orphans = [];
    for (const [file, { params }] of factories) {
      for (const param of params) {
        if (declared.has(param) || valueSet.has(param) || returnedHandlers.has(param)) continue;
        orphans.push(`${file}: ${param}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test("each factory's call hands over exactly what its signature asks for", () => {
    const problems = [];
    for (const [, { factory, params }] of factories) {
      const call = panel.match(new RegExp(`const ${factory}Result = ${factory}\\(([\\s\\S]*?)\\);`));
      expect({ factory, called: Boolean(call) }).toEqual({ factory, called: true });
      const argument = call[1];
      for (const param of params) {
        const owner = returnedBy.get(param);
        if (owner) {
          if (!argument.includes(`...${owner}Result`)) problems.push(`${factory}: reads ${param} but does not spread ${owner}Result`);
        } else if (valueSet.has(param)) {
          if (!argument.includes("...values")) problems.push(`${factory}: reads ${param} but does not spread values`);
        } else if (!new RegExp(`[{,\\s]${param}[,}\\s]`).test(argument)) {
          // a name the panel computes itself, after the early return: it must be
          // handed over by name
          problems.push(`${factory}: reads ${param}, which the panel does not hand it`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test("every block reads something `ctx` carries", () => {
    const provided = new Set([...valueSet, ...returnedHandlers, ...ctxKeys]);
    const orphans = [];
    for (const file of BLOCKS) {
      for (const prop of blockProps.get(file)) if (!provided.has(prop)) orphans.push(`${file}: ${prop}`);
    }
    expect(orphans).toEqual([]);
  });

  test("`ctx` carries the handlers in call order, then the panel's own names, then the values", () => {
    expect(ctxSpreads).toEqual([...callOrder.map((factory) => `...${factory}Result`), "...values"]);
    // and the call order is a real order: a factory is called after the factory
    // whose handler it reads
    const at = new Map(callOrder.map((factory, index) => [factory, index]));
    const tooEarly = [];
    // called once each, and called at all: a second call would run the factory's
    // body twice for nothing
    expect(callOrder.length).toBe(factories.size);
    expect(new Set(callOrder).size).toBe(callOrder.length);
    for (const { factory, params } of factories.values()) {
      expect(panel).toContain(`const ${factory}Result = ${factory}(`);
      for (const param of params) {
        const owner = returnedBy.get(param);
        if (!owner || !at.has(owner)) continue;
        if (at.get(owner) > at.get(factory)) tooEarly.push(`${factory} is called before ${owner}, whose ${param} it reads`);
      }
    }
    expect(tooEarly).toEqual([]);
    // the names the panel computes after the early return sit between the handlers
    // and the values, so a value can never shadow one
    const last = ctxSpreads.at(-1);
    const ctxBlock = panel.slice(panel.indexOf("const ctx = {")).split("\n  };")[0];
    expect(ctxKeys.filter((n) => !valueSet.has(n) && !returnedHandlers.has(n)).every((n) => ctxBlock.indexOf(`    ${n},`) > ctxBlock.indexOf(`    ${last.slice(3)}`))).toBe(true);
    expect(last).toBe("...values");
  });

  test("`values` holds nothing nobody reads — and no handler, which would shadow it", () => {
    // what the other side actually consumes: a factory's parameters, a block's
    // props, a returned handler, a name `ctx` carries of its own
    const read = new Set([
      ...[...factories.values()].flatMap(({ params }) => params),
      ...returnedHandlers,
      ...[...blockProps.values()].flat(),
      ...ctxKeys,
    ]);
    expect(valueKeys.filter((name) => !read.has(name))).toEqual([]);
    expect(valueKeys.filter((name) => returnedHandlers.has(name))).toEqual([]);
  });

  test("a factory returns nothing nobody reads", () => {
    // a dead export is not a wiring: it is a name the panel hands to every block
    // that nobody opens. It also hides a real mistake — a handler moved to the
    // wrong factory still "reaches" something.
    const consumed = new Set([
      ...[...factories.values()].flatMap(({ params }) => params),
      ...valueSet,
      ...ctxKeys,
      ...ownFromResult,
      ...[...blockProps.values()].flat(),
    ]);
    const dead = [];
    for (const [file, { factory }] of factories) {
      for (const name of returnedNames(read(path.join(ACTIONS, file)))) {
        if (!consumed.has(name)) dead.push(`${file}: ${factory}() returns ${name}, which nobody reads`);
      }
    }
    expect(dead).toEqual([]);
  });

  test("a block reads exactly what its signature lists — nothing left out", () => {
    const problems = [];
    for (const file of BLOCKS) {
      const src = read(path.join(PROFILES, file));
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
    const declared = new Set(declaredNames(panel, "AccessProfilesView"));
    expect(valueKeys.filter((name) => !declared.has(name))).toEqual([]);
  });

  test("nothing is read before the panel declares it", () => {
    // `values` naming a name the panel computes after the early return would put
    // that name in the temporal dead zone: a ReferenceError on the first render
    const declaredAt = new Map();
    for (const [index, stmt] of body.entries()) {
      if (stmt.type !== "VariableDeclaration") continue;
      for (const decl of stmt.declarations) {
        for (const name of boundNames(decl.id)) if (!declaredAt.has(name)) declaredAt.set(name, index);
      }
    }
    const reads = [
      { at: statementIndex((s) => s.declarations?.some((d) => d.id.name === "values")), keys: valueKeys },
      { at: statementIndex((s) => s.declarations?.some((d) => d.id.name === "ctx")), keys: ctxKeys },
      ...body.flatMap((stmt) => {
        if (stmt.type !== "VariableDeclaration") return [];
        const decl = stmt.declarations.find((d) => /Result$/.test(d.id.name));
        if (!decl) return [];
        return [{ at: body.indexOf(stmt), keys: [...handedOver(panel, `const ${decl.id.name} = ${decl.init.callee.name}(`)] }];
      }),
    ];
    const problems = [];
    for (const { at, keys } of reads) {
      for (const key of keys) {
        // a handler is declared in its factory, not here
        if (!declaredAt.has(key) || returnedHandlers.has(key)) continue;
        if (declaredAt.get(key) > at) problems.push(`${key} is declared after line ${body[at].loc.start.line} reads it`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("the panel keeps its parameter, its loaders, its effects and its early return", () => {
    // `initialProfileId` is the panel's parameter: the deep link and the
    // preselection effect read it, and no factory needs it
    expect(panel).toContain("initialProfileId = null");
    expect(valueSet.has("initialProfileId")).toBe(false);
    // the reads, the two memoised loaders and the three effects stay in the panel
    expect(panel).toContain("const { t } = useI18n();");
    expect(panel).toContain("const { confirm } = useDialogs();");
    expect(panel.match(/useCallback\(/g)).toHaveLength(2);
    expect(panel.match(/useEffect\(/g)).toHaveLength(3);
    for (const [file, src] of [...actionFiles.map((f) => [f, read(path.join(ACTIONS, f))]), ...BLOCKS.map((f) => [f, read(path.join(PROFILES, f))])]) {
      // a hook called from a factory or a block would break the hook order
      expect({ file, hooks: src.match(/\buse[A-Z]\w*\(/g) || [] }).toEqual({ file, hooks: [] });
    }
    // the panel is what renders the blocks
    for (const file of BLOCKS) {
      expect(panel).toContain(`<${file.replace(/\.js$/, "")} ctx={ctx} />`);
    }
  });

  test("the early return still comes first, and the derivations still skip it", () => {
    const earlyAt = statementIndex((s) => s.type === "IfStatement" && panel.slice(s.loc.start.index, s.loc.start.index + 20).includes("loading"));
    expect(earlyAt).toBeGreaterThan(-1);
    // `values` is built before it, so the factories that read `values` exist on
    // the loading render too
    expect(statementIndex((s) => s.declarations?.some((d) => d.id.name === "values"))).toBeLessThan(earlyAt);
    // …but the two derivations stay after it, exactly where the monolith had
    // them: on the loading render they must not run
    for (const name of ["changesCount", "selectedIsDefaultFor"]) {
      expect(statementIndex((s) => s.declarations?.some((d) => d.id.name === name))).toBeGreaterThan(earlyAt);
    }
    // and the factory that reads one of them is called after it, not before
    expect(statementIndex((s) => /catalogSectionsResult = catalogSections\(/.test(panel.slice(s.loc.start.index, s.loc.start.index + 80)))).toBeGreaterThan(
      statementIndex((s) => s.declarations?.some((d) => d.id.name === "selectedIsDefaultFor")),
    );
  });
});
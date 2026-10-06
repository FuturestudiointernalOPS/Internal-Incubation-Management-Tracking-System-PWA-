/**
 * The individual-access editor wiring.
 *
 * PersonAccessScreen.js keeps every state value, read and write; its markup
 * lives in person-access/PersonAccessView.js, which reads everything through a
 * single `ctx` object. Nothing at the type level connects the two, and no test
 * renders this screen, so a name that stops reaching the view is invisible:
 * the markup reads `undefined`. So this suite pins the wiring itself:
 *
 *   - every name the view destructures from `ctx` must be a key the screen
 *     actually puts in `ctx` (else it renders undefined);
 *   - every key of `ctx` must be a name the screen really declares (a ghost key
 *     is a value that never existed);
 *   - the screen must render the view with its ctx.
 */

const fs = require("node:fs");
const path = require("node:path");
const parser = require("@babel/parser");

const ROOT = path.join(__dirname, "..");
const SCREEN = path.join(ROOT, "components", "permissions", "permission-center", "PersonAccessScreen.js");
const VIEW = path.join(ROOT, "components", "permissions", "permission-center", "person-access", "PersonAccessView.js");

const read = (file) => fs.readFileSync(file, "utf8");

/** The four-space-indented `name,` lines between an opening needle and a close. */
function keysBetween(src, openNeedle, closeNeedle) {
  const start = src.indexOf(openNeedle);
  if (start === -1) throw new Error(`no ${openNeedle}`);
  const rest = src.slice(start + openNeedle.length);
  const end = rest.indexOf(closeNeedle);
  if (end === -1) throw new Error(`no ${closeNeedle}`);
  return [...rest.slice(0, end).matchAll(/^ {4}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]);
}

/** The names one function's body declares (top level). */
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

const screen = read(SCREEN);
const view = read(VIEW);

const viewCtxKeys = keysBetween(view, "const {", "\n  } = ctx;");
const ctxKeys = keysBetween(screen, "const ctx = {", "\n  };");
const ctxSet = new Set(ctxKeys);

describe("the individual-access editor wiring", () => {
  test("the view reads only names the screen puts in `ctx`", () => {
    const orphans = viewCtxKeys.filter((name) => !ctxSet.has(name));
    expect(orphans).toEqual([]);
  });

  test("every key of `ctx` is a name the screen really declares", () => {
    const declared = new Set(declaredNames(screen, "PersonAccessScreen"));
    expect(ctxKeys.filter((name) => !declared.has(name))).toEqual([]);
  });

  test("the screen renders the view with its ctx", () => {
    expect(screen).toContain("<PersonAccessView ctx={ctx} />");
  });
});

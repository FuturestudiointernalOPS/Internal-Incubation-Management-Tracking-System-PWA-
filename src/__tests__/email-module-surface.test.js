/**
 * The email service's public surface and module graph.
 *
 * `src/lib/email.js` is a facade: the implementation lives in `src/lib/email/`,
 * one module per concern. That arrangement is invisible to the compiler — a name
 * that quietly disappears from the facade breaks 27 importing modules at runtime,
 * not at build time, and a cycle between two email modules would only show up as
 * an undefined binding in the middle of a send. ESLint sees each module alone and
 * cannot answer either question.
 *
 * So this suite pins the arrangement:
 *  - every name the repository imports from `@/lib/email` is exported by the facade;
 *  - every name the facade exports is defined by exactly one module (no copy, no
 *    orphan), except the delivery log, which is re-exported from the service layer;
 *  - the graph is acyclic: a module may only import from modules that come before it;
 *  - no module imports a name it does not use.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");   // src/
const REPO = path.join(__dirname, "../.."); // repository root
const DIR = path.join(ROOT, "lib", "email");
const FACADE = path.join(ROOT, "lib", "email.js");

const read = (file) => fs.readFileSync(file, "utf8");
const modules = [
  ...fs.readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".js")).map((e) => e.name),
  ...fs.readdirSync(path.join(DIR, "senders"), { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(".js")).map((e) => `senders/${e.name}`),
];

/** A name inside `{ … }` or after `const`/`function`, at the start of a line. */
const definedIn = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/^(?:export )?(?:async )?function ([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^(?:export )?(?:const|let|var) ([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return names;
};

const facade = read(FACADE);
const facadeNames = new Set([...facade.matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]));
// the log block is the last `export { … } from "@/services/email/log"`
const logNames = new Set(
  [...facade.slice(facade.lastIndexOf("export {")).matchAll(/^ {2}([A-Za-z_$][\w$]*),$/gm)].map((m) => m[1]),
);

const definedBy = new Map(); // name -> [module files]
for (const name of modules) {
  for (const defined of definedIn(read(path.join(DIR, name)))) {
    definedBy.set(defined, [...(definedBy.get(defined) || []), name]);
  }
}

/** Every `from "<path>"` inside a module, resolved to the file it points at. */
const edges = new Map(
  modules.map((name) => {
    const imports = [...read(path.join(DIR, name)).matchAll(/^import \{[^}]*\} from "(\.[^"]+)";$/gm)].map((m) => m[1]);
    return [name, imports.map((spec) => {
      const base = spec.replace(/^\.\//, "");
      return modules.includes(`${base}.js`) ? `${base}.js` : modules.includes(base) ? base : null;
    })];
  }),
);

describe("the email service facade", () => {
  test("every name imported from @/lib/email is exported by the facade", () => {
    const imported = new Map();
    const files = execSync('grep -rl \'from "@/lib/email"\' src', { cwd: REPO, encoding: "utf8" })
      .trim()
      .split("\n")
      // this suite mentions the module path itself; a test is not an importer
      .filter((file) => !file.includes("__tests__/"));
    for (const file of files) {
      const src = read(path.join(REPO, file));
      let at = 0;
      while ((at = src.indexOf('from "@/lib/email"', at)) !== -1) {
        const clause = src.slice(src.lastIndexOf("import", at), at);
        for (const m of clause.matchAll(/\{([\s\S]*?)\}/g)) {
          for (const raw of m[1].split(",")) {
            const name = raw.trim().split(/\s+as\s+/)[0].trim();
            if (/^[A-Za-z_$][\w$]*$/.test(name)) imported.set(name, [...(imported.get(name) || []), file]);
          }
        }
        at += 1;
      }
    }
    expect(imported.size).toBeGreaterThan(20);
    const missing = [...imported.keys()].filter((name) => !facadeNames.has(name));
    expect(missing).toEqual([]);
  });

  test("every name the facade exports is defined by exactly one module", () => {
    const orphans = [...facadeNames].filter((name) => !logNames.has(name) && !definedBy.has(name));
    expect(orphans).toEqual([]);
    for (const [name, homes] of definedBy) {
      // a helper may be shared, but the public names may not be duplicated
      if (!facadeNames.has(name)) continue;
      expect({ name, homes }).toEqual({ name, homes: [homes[0]] });
    }
  });

  test("the module graph is acyclic", () => {
    const cycles = [];
    const seen = new Set();
    const walk = (name, trail) => {
      if (trail.includes(name)) {
        cycles.push([...trail.slice(trail.indexOf(name)), name].join(" → "));
        return;
      }
      if (seen.has(name)) return;
      seen.add(name);
      for (const next of edges.get(name) || []) if (next) walk(next, [...trail, name]);
    };
    for (const name of modules) walk(name, []);
    expect(cycles).toEqual([]);
    expect(modules.length).toBeGreaterThanOrEqual(11);
  });

  test("no module imports a name it does not use", () => {
    const unused = [];
    for (const name of modules) {
      const src = read(path.join(DIR, name));
      const importLines = src.match(/^import \{[^}]*\} from "[^"]+";$/gm) || [];
      const body = src.split("\n").filter((l) => !importLines.includes(l)).join("\n");
      for (const line of importLines) {
        for (const imported of line.match(/\{([^}]*)\}/)[1].split(",")) {
          const local = imported.trim().split(/\s+as\s+/).pop().trim();
          if (local && !new RegExp(`\\b${local}\\b`).test(body)) unused.push(`${name}: ${local}`);
        }
      }
    }
    expect(unused).toEqual([]);
  });
});
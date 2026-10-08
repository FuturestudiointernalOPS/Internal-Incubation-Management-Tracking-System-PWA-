/**
 * The user-access screen wiring.
 *
 * The screen (`src/app/admin/access/page.js`) keeps the state, the reads and
 * the supervisor handlers; its markup lives in
 * `src/components/admin/access/UserAccessView.js`, which reads everything
 * through one `ctx` object the screen builds by hand. No behavioural test
 * renders the screen, so a key that stops being declared - or a name the view
 * reads that the screen never puts in `ctx` - is invisible. This suite pins the
 * contract.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PARENT = path.join(ROOT, "app", "admin", "access", "page.js");
const VIEW = path.join(ROOT, "components", "admin", "access", "UserAccessView.js");

const read = (file) => fs.readFileSync(file, "utf8");

describe("the user-access screen wiring", () => {
  const parent = read(PARENT);
  const view = read(VIEW);

  const ctxKeys = new Set(
    [...parent.split("const ctx = {")[1].split("};")[0].matchAll(/^ {4}([A-Za-z_$][\w$]*),$/gm)].map(
      (m) => m[1],
    ),
  );

  const destructure = view.match(/const \{([^}]*)\} = ctx;/);
  const viewKeys = destructure
    ? destructure[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  test("every name the view reads is a key of `ctx`", () => {
    expect(viewKeys.filter((key) => !ctxKeys.has(key))).toEqual([]);
  });

  test("every key of `ctx` is read by the view", () => {
    const viewKeySet = new Set(viewKeys);
    expect([...ctxKeys].filter((key) => !viewKeySet.has(key))).toEqual([]);
  });

  test("the screen renders the view with its `ctx`", () => {
    expect(parent).toContain("<UserAccessView ctx={ctx} />");
  });
});

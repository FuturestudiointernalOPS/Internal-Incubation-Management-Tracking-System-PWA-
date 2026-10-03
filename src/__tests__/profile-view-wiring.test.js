/**
 * The profile view wiring.
 *
 * The screen (`src/components/dashboard/ProfileView.js`) keeps the state, the
 * reads and the early loading/error returns; its markup lives in
 * `src/components/dashboard/profile-view/ProfileViewContent.js`, which reads
 * everything through one `ctx` object the screen builds by hand. No type
 * connects the two sides and no behavioural test renders the screen, so a key
 * that stops being declared - or a name the view reads that the screen never
 * puts in `ctx` - is invisible. This suite pins the contract: every name the
 * view destructures is a key of `ctx`, every key of `ctx` is read, and the
 * screen renders the view with it.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const PARENT = path.join(ROOT, "components", "dashboard", "ProfileView.js");
const VIEW = path.join(
  ROOT,
  "components",
  "dashboard",
  "profile-view",
  "ProfileViewContent.js",
);

const read = (file) => fs.readFileSync(file, "utf8");

describe("the profile view wiring", () => {
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
    expect(parent).toContain("<ProfileViewContent ctx={ctx} />");
  });
});

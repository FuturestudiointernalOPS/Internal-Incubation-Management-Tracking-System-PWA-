/**
 * The course table lost its public name (the `slug` column). Nothing may ask
 * for it any more.
 *
 * The fake test database cannot catch this class of mistake — it does not
 * enforce the real schema, so a query naming a dropped column passes every
 * check while failing in production (which is exactly how a missing price on
 * the checkout form slipped through). So this guard reads the sources: for
 * every SELECT on the course table, the column list must not name the slug.
 */

const fs = require("fs");
const path = require("path");

test("no model asks the course table for the dropped slug column", () => {
  const dir = path.join(process.cwd(), "src", "models", "lms");
  const offenders = [];

  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const source = fs.readFileSync(path.join(dir, name), "utf8");
    for (const match of source.matchAll(/select\b([\s\S]*?)\bfrom\s+lms_courses\b/gi)) {
      if (/\bslug\b/i.test(match[1])) {
        offenders.push(`${name}: ${match[1].trim().slice(0, 60)}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});

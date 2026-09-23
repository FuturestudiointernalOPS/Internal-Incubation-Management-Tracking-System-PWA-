/**
 * THE FOUNDER'S "MY VENTURES" CARD SHOWS THE COMPANY, NOT THE INTAKE RUN.
 *
 * The defect this locks shut: a Venture's label lives in TWO columns — the
 * canonical `company_name` and the legacy `name`. Creation writes both the same,
 * but a rename only ever carried `company_name`, so `name` stayed frozen at the
 * value it was created with. For a Venture that came in through the application
 * Run, that value is the RUN's name ("Venture Registration Form Run"): the
 * founder opened My Ventures and read the form that collected their application
 * instead of their own company.
 *
 * Two things make the fix true, and both are pinned here:
 *   1. the card resolves the name company_name-first, like every other Ventures
 *      surface (admin list, staff list, the Venture's own page);
 *   2. a rename mirrors the two columns, so they can never drift again.
 */

const fs = require("fs");
const path = require("path");

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("My Ventures shows the company name", () => {
  test("the card resolves the name company_name-first", () => {
    const src = read("src/app/participant/ventures/page.js");
    expect(src).toMatch(/\{venture\.company_name \|\| venture\.name\}/);
    // The bare legacy column is never the card's title on its own.
    expect(src).not.toMatch(/<h3[^>]*>\{venture\.name\}<\/h3>/);
  });

  test("a rename keeps the legacy name column in step with company_name", () => {
    const src = read("src/lib/ventures.js");
    expect(src).toMatch(/mirrored\.name = mirrored\.company_name/);
    expect(src).toMatch(/mirrored\.company_name = mirrored\.name/);
  });

  test("existing drifted rows are repaired by the Venture schema self-heal", () => {
    const src = read("src/lib/ventures.js");
    expect(src).toMatch(/SET name = company_name WHERE company_name IS NOT NULL/);
  });
});

/**
 * EVERY SURFACE THAT NAMES A VENTURE READS `company_name` FIRST.
 *
 * A Venture's label lives in TWO columns: the canonical `company_name` and the
 * legacy `name`. Creation writes both the same, but the legacy column stayed
 * frozen at whatever the Venture was created with — and for a Venture that came
 * in through the application Run, that value is the RUN's name
 * ("Venture Registration Form Run"). A surface that reads `name` first therefore
 * shows the form that collected the application instead of the company.
 *
 * The founder's My Ventures card was the first such surface (see
 * my-ventures-name.test.js). This file pins the rest: the member invitation
 * (in-app notice, email and acceptance screen), the Permission Center's scope
 * labels, and the portfolio reports.
 */

const fs = require("fs");
const path = require("path");

const read = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("a Venture is named company_name-first everywhere", () => {
  test("the member invitation notices and email read the company name", () => {
    const src = read("src/app/api/ventures/[id]/members/route.js");
    expect(src).toMatch(/COALESCE\(NULLIF\(company_name, ''\), name\) AS venture_name/);
  });

  test("the invitation acceptance screen reads the company name", () => {
    const src = read("src/models/ventureMemberInvitations.js");
    expect(src).toMatch(/COALESCE\(NULLIF\(company_name, ''\), name\) AS venture_name/);
  });

  test("the Permission Center scope labels read the company name", () => {
    const src = read("src/models/authorization/contactContexts.js");
    expect(src).toMatch(/COALESCE\(NULLIF\(company_name, ''\), name,/);
  });

  test("the portfolio reports read the company name", () => {
    const src = read("src/lib/ventureReports.js");
    // Both the report list and the journeys missing their closing report.
    expect(src.match(/venture_name: row\.company_name \|\| row\.name/g)).toHaveLength(2);
  });

  test("no surface resolves the legacy column first", () => {
    for (const file of [
      "src/app/api/ventures/[id]/members/route.js",
      "src/models/ventureMemberInvitations.js",
      "src/models/authorization/contactContexts.js",
      "src/lib/ventureReports.js",
      "src/app/participant/ventures/page.js",
    ]) {
      const src = read(file);
      expect(src).not.toMatch(/COALESCE\(NULLIF\(name, ''\), company_name/);
      expect(src).not.toMatch(/row\.name \|\| row\.company_name/);
    }
  });
});

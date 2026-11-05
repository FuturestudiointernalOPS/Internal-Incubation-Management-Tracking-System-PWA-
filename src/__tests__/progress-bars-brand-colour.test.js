/** Every progress bar is the Future Studio colour (one token), for every role. */
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

test("the colour is one token, defined once, and it is the brand colour", () => {
  expect(read("src/app/globals.css")).toMatch(/--progress-fill:\s*var\(--brand-orange\)/);
});

test("the kit's progress bar (journeys, dashboards, projects, all roles) fills with it", () => {
  const css = read("src/components/staff/staff.css");
  expect(css).toMatch(/\.stf-bar-prog i \{[^}]*background: var\(--progress-fill\)/);
  expect(css).not.toMatch(/\.stf-bar-prog i \{[^}]*gradient/);
});

test("the Super Admin venture screens use it too, whatever the percentage", () => {
  for (const file of [
    "src/app/admin/ventures/[id]/knowledge/page.js",
    "src/app/admin/ventures/[id]/reports/page.js",
    "src/app/admin/ventures/[id]/fundraising/page.js",
    "src/components/ventures/timeline/VentureTimelineView.js",
    "src/components/ventures/workspace/tabs/GrowthTabs.js",
  ]) {
    const source = read(file);
    expect(source).toContain("--progress-fill");
    // no more threshold colours on the bar fills
    expect(source).not.toMatch(/h-full rounded-full[^\n]*bg-emerald-500/);
  }
});

/** The Timeline lives inside the Venture's Project page, not as a hub tab. */
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

test("the hub no longer has a Timeline tab or route", () => {
  const hub = read("src/components/admin/ventures/VentureDetailView.js");
  expect(hub).not.toContain('id: "timeline"');
  expect(hub).not.toContain("/timeline`");
});

test("the Project page offers Work and Timeline views, the latter embedding the timeline", () => {
  const page = read("src/app/admin/ventures/[id]/projects/page.js");
  expect(page).toContain('"timeline"');
  expect(page).toContain("<VentureTimelineView id={id} embedded />");
  expect(page).toContain("venture.projects.viewWork");
  expect(page).toContain("venture.projects.viewTimeline");
});

test("the old timeline address forwards to the Project page's Timeline view", () => {
  const redirectPage = read("src/app/admin/ventures/[id]/timeline/page.js");
  expect(redirectPage).toContain("redirect(`/admin/ventures/${id}/projects?view=timeline`)");
});

test("embedded drops the page header but keeps the view switch", () => {
  const view = read("src/components/ventures/timeline/VentureTimelineView.js");
  expect(view).toContain("{!embedded && (");
  expect(view).toContain('["gantt", "progress", "delay"]');
});

/**
 * The Timeline lives inside the Venture's Project view, never as an address of
 * its own: it is a sub-view (`?tab=projects&view=timeline`) of the one hub
 * address. The old `/timeline` address is a retired address of that view and
 * is redirected by the generated table.
 */
import fs from "node:fs";
import path from "node:path";

const { SCREENS_BY_ID } = require("@/lib/routes");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

test("the hub has no Timeline tab of its own", () => {
  const nav = read("src/spaces/admin/components/ventures/VentureHubNav.js");
  expect(nav).not.toContain('key: "timeline"');
  expect(nav).not.toContain("tab=timeline");
});

test("the Project view offers Work and Timeline views, the latter embedding the timeline", () => {
  const page = read("src/spaces/admin/components/ventures/views/VentureProjectsView.js");
  expect(page).toContain('"timeline"');
  expect(page).toContain("<VentureTimelineView id={id} embedded />");
  expect(page).toContain("venture.projects.viewWork");
  expect(page).toContain("venture.projects.viewTimeline");
});

test("the retired timeline address is a legacy of the Project's Timeline view", () => {
  const row = SCREENS_BY_ID.get("admin.ventures.detail.projects.timeline");
  expect(row).toBeDefined();
  expect(row.path).toBe("/admin/ventures/[id]");
  expect(row.tab).toBe("projects");
  expect(row.query).toBe("view=timeline");
  expect(row.legacy).toEqual(["/admin/ventures/[id]/timeline"]);
  expect(row.pending).toBeUndefined();
});

test("embedded drops the page header but keeps the view switch", () => {
  const view = read("src/components/shared/ventures/console/timeline/VentureTimelineView.js");
  expect(view).toContain("{!embedded && (");
  expect(view).toContain('["gantt", "progress", "delay"]');
});

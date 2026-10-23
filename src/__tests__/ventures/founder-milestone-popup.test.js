/** Founder journey: a milestone is one line, its tasks open in a pop-up (as in the manager's view). */
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js"),
  "utf8",
);

test("each milestone is a single row that opens a dialog", () => {
  expect(source).toContain('onClick={() => setOpenMilestoneId(milestone.id)}');
  expect(source).toContain('aria-haspopup="dialog"');
  expect(source).toContain('className="jy-mtog"');
});

test("the pop-up carries the milestone's deliverables, sessions and tasks", () => {
  const modal = source.slice(source.indexOf("<AppModal"));
  expect(modal).toContain("renderMilestoneDetail(openMilestoneStage, openMilestone)");
  const detail = source.slice(source.indexOf("const renderMilestoneDetail"), source.indexOf("return (\n    <div className=\"space-y-4\">"));
  expect(detail).toContain("<FounderMilestoneDeliverables");
  expect(detail).toContain("<FounderMilestoneSessions");
  expect(detail).toContain("<FounderMilestoneTasks");
});

test("the row no longer renders the work inline", () => {
  const rows = source.slice(source.indexOf("stage.milestones.map((milestone)"), source.indexOf("<AppModal"));
  expect(rows).not.toContain("<FounderMilestoneDeliverables");
});

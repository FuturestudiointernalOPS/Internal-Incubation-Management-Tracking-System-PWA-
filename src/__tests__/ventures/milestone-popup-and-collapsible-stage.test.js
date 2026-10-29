/**
 * @jest-environment jsdom
 *
 * The Venture Manager journey: a milestone's tasks open in a pop-up (the row
 * stays one line), and a journey folds down to its header.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/components/ventures/journey/MilestoneDeliverables", () => function MockMilestoneDeliverables() { return <div data-testid="tasks-content">TASKS CONTENT</div>; });
jest.mock("@/components/ventures/journey/MilestoneReviewInbox", () => () => null);
jest.mock("@/components/ventures/journey/MilestoneSessionsList", () => () => null);
jest.mock("@/components/ventures/ScopedNotes", () => () => null);
jest.mock("@/components/ventures/VenturePersonField", () => () => null);
jest.mock("@/components/ventures/journey/JourneyReportSection", () => function MockJourneyReportSection() { return <div data-testid="report-section" />; });
jest.mock("@/components/ventures/journey/AddMilestoneForm", () => function MockAddMilestoneForm() { return <div data-testid="add-milestone" />; });

const { I18nProvider } = require("@/lib/i18n");
const JourneyMilestoneRow = require("@/components/ventures/journey/JourneyMilestoneRow").default;

const noop = () => {};
const milestone = {
  id: "m1",
  title: "Foundation & Compliance Setup",
  status: "in_progress",
  owner_name: "Awa",
  deliverables: [{ id: "d1", title: "Certificate" }],
  activities: [{ id: "a1" }],
};
const rowProps = (open, toggle) => ({
  milestone, milestoneIndex: 0, milestones: [milestone], stage: { id: "s1", status: "active" }, stages: [],
  access: { manage: true, edit: true, create: true }, milestoneAuthority: true,
  milestoneEditId: null, setMilestoneEditId: noop, milestoneEditForm: {}, setMilestoneEditForm: noop, saveMilestoneEdit: noop,
  milestoneOpenId: open, toggleMilestoneOpen: toggle, milestoneBusy: null,
  milestoneMenuItems: () => [], milestoneDotClass: () => "", milestoneStatusClass: () => "stf-tag", milestoneStatusKey: () => "In Progress",
  fmtDate: (value) => String(value), milestoneSubmissions: {}, ventureSessions: [], notesMilestoneId: null,
  deliverableStatus: () => ({}), DELIVERABLE_TYPES: [],
});
const row = (open, toggle = noop) => render(<I18nProvider><JourneyMilestoneRow {...rowProps(open, toggle)} /></I18nProvider>);

test("a closed milestone is one line: no task content on the page", () => {
  row(null);
  expect(screen.getByText("Foundation & Compliance Setup")).toBeTruthy();
  expect(screen.queryByTestId("tasks-content")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("clicking the row asks the panel to open that milestone", () => {
  const toggle = jest.fn();
  row(null, toggle);
  fireEvent.click(screen.getByText("Foundation & Compliance Setup"));
  expect(toggle).toHaveBeenCalledWith("m1");
});

test("an open milestone shows its tasks in a pop-up, and closing it toggles the panel", () => {
  const toggle = jest.fn();
  row("m1", toggle);
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("TASKS CONTENT");
  expect(dialog.textContent).toContain("Foundation & Compliance Setup");
  expect(dialog.textContent).toContain("Awa"); // the facts live in the pop-up too
  fireEvent.click(screen.getByRole("button", { name: /close/i }));
  expect(toggle).toHaveBeenCalledWith("m1");
});

test("another milestone being open does not open this one", () => {
  row("other");
  expect(screen.queryByRole("dialog")).toBeNull();
});

describe("the journey card folds down to its header", () => {
  const JourneyStageCard = require("@/components/ventures/journey/JourneyStageCard").default;
  const stage = {
    id: "s1", name: "Foundation to Investment Readiness", status: "active", description: "The foundation", objective: "Open the round",
    milestones: [milestone], milestone_counts: { completed: 0, total: 1 },
  };
  const props = {
    ...rowProps(null, noop), stage, index: 0, lang: "en",
    editId: null, setEditId: noop, editForm: {}, setEditForm: noop, saveEdit: noop,
    selectedStageIds: new Set(), toggleSelectStage: noop, stageNodeClass: () => "", statusPill: () => <span>In Progress</span>,
    journeyMenuItems: () => [], restoreOneJourney: noop, bulkBusy: false, reportsByStage: {},
    milestoneAddFor: null, milestoneDeliverables: [], milestoneForm: {}, milestoneSaving: false,
  };
  const card = () => render(<I18nProvider><JourneyStageCard {...props} /></I18nProvider>);

  test("open by default: milestones, report section and description are visible", () => {
    card();
    expect(screen.getByText("Foundation & Compliance Setup")).toBeTruthy();
    expect(screen.getByTestId("report-section")).toBeTruthy();
    expect(screen.getByText("The foundation")).toBeTruthy();
  });

  test("collapsing keeps the title, status and progress and hides the rest; expanding brings it back", () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.getByText("Foundation to Investment Readiness")).toBeTruthy();
    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.queryByText("Foundation & Compliance Setup")).toBeNull();
    expect(screen.queryByTestId("report-section")).toBeNull();
    expect(screen.queryByText("The foundation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Foundation & Compliance Setup")).toBeTruthy();
  });

  test("a click anywhere on the header bar folds and unfolds it — not only on the arrow", () => {
    card();
    // on the title (not a button)
    fireEvent.click(screen.getByText("Foundation to Investment Readiness"));
    expect(screen.queryByText("Foundation & Compliance Setup")).toBeNull();
    // on the status chip
    fireEvent.click(screen.getByText("In Progress"));
    expect(screen.getByText("Foundation & Compliance Setup")).toBeTruthy();
    // on the progress line
    fireEvent.click(screen.getByText(/0%/));
    expect(screen.queryByText("Foundation & Compliance Setup")).toBeNull();
  });

  test("the arrow still works on its own, once (the bar does not double-toggle it)", () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Foundation & Compliance Setup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Foundation & Compliance Setup")).toBeTruthy();
  });
});

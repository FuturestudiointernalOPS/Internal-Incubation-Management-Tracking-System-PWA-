/**
 * @jest-environment jsdom
 *
 * The founder journey's activities are collapsible: collapsed by default with
 * their reference, title and deliverable status in the header; one click opens
 * the details; "Expand/Collapse" opens or closes them all.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/components/ventures/journey/FounderSessionBooking", () => function MockFounderSessionBooking() { return <div data-testid="booking" />; });
jest.mock("@/components/ventures/journey/DeliverableDetailDialog", () => () => null);

const { I18nProvider } = require("@/lib/i18n");
const FounderMilestoneDeliverables = require("@/components/ventures/workspace/tabs/JourneyPlaybookTabs/FounderMilestoneDeliverables").default;

const activity = (id, ref, title) => ({ id, source_ref: ref, title, definition_of_done: `Done when ${title}`, owner_name: "Awa" });
const milestone = {
  id: "m1",
  activities: [activity("a1", "FT-01", "Register the company"), activity("a2", "FT-02", "Draft the agreement")],
  deliverables: [
    { id: "d1", title: "Certificate of incorporation", status: "completed", approval_status: "approved", activity: activity("a1", "FT-01", "Register the company") },
    { id: "d2", title: "Signed agreement", status: "pending", approval_status: "pending", activity: activity("a2", "FT-02", "Draft the agreement") },
  ],
};

const view = () =>
  render(
    <I18nProvider>
      <FounderMilestoneDeliverables milestone={milestone} stage={{ status: "active" }} dvDrafts={{}} setDvDrafts={() => {}} submitDeliverable={() => {}} canBook />
    </I18nProvider>,
  );

test("collapsed by default: header shows reference, title and status; details are hidden", () => {
  view();
  expect(screen.getByText("Register the company")).toBeTruthy();
  expect(screen.getByText("FT-01")).toBeTruthy();
  expect(screen.getByText("Approved")).toBeTruthy();
  expect(screen.queryByText("Certificate of incorporation")).toBeNull();
  expect(screen.queryByText(/Done when Register the company/)).toBeNull();
  expect(screen.queryAllByTestId("booking")).toHaveLength(0);
});

test("clicking an activity opens its details, clicking again closes them", () => {
  view();
  const header = screen.getByText("Register the company").closest("button");
  expect(header.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(header);
  expect(header.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Certificate of incorporation")).toBeTruthy();
  expect(screen.getByText(/Done when Register the company/)).toBeTruthy();
  // the other activity stays closed
  expect(screen.queryByText("Signed agreement")).toBeNull();
  fireEvent.click(header);
  expect(screen.queryByText("Certificate of incorporation")).toBeNull();
});

test("Expand opens every activity, Collapse closes them all", () => {
  view();
  fireEvent.click(screen.getByRole("button", { name: "Expand" }));
  expect(screen.getByText("Certificate of incorporation")).toBeTruthy();
  expect(screen.getByText("Signed agreement")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
  expect(screen.queryByText("Certificate of incorporation")).toBeNull();
  expect(screen.queryByText("Signed agreement")).toBeNull();
});

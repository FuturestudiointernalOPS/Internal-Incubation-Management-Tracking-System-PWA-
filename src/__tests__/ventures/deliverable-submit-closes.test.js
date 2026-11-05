/**
 * @jest-environment jsdom
 *
 * A founder submits evidence from the deliverable's dialog: once it is in, the
 * dialog closes by itself; if it was not sent (empty, or refused) it stays open.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/components/ventures/journey/FounderSessionBooking", () => () => null);

const { I18nProvider } = require("@/lib/i18n");
const FounderMilestoneDeliverables = require("@/components/ventures/workspace/tabs/JourneyPlaybookTabs/FounderMilestoneDeliverables").default;

const milestone = {
  id: "m1",
  title: "Pilot",
  deliverables: [{ id: "d1", title: "Onboarding screens", status: "pending", approval_status: "pending", task_id: 7, activity: { id: 7, title: "Build the flow", definition_of_done: "A farmer can register" } }],
  activities: [{ id: 7, title: "Build the flow", definition_of_done: "A farmer can register" }],
};

const mount = (submitDeliverable) =>
  render(
    <I18nProvider>
      <FounderMilestoneDeliverables
        milestone={milestone}
        stage={{ status: "active" }}
        dvDrafts={{ d1: { url: "https://example.org/doc.pdf", file: null } }}
        setDvDrafts={() => {}}
        submitDeliverable={submitDeliverable}
        canBook={false}
        openBooking={() => {}}
        setBookFor={() => {}}
        setBookForm={() => {}}
      />
    </I18nProvider>,
  );

const openDialog = async () => {
  // the activity block is collapsible: open it, then the deliverable row
  const head = screen.queryByRole("button", { name: /Build the flow/ });
  if (head && head.getAttribute("aria-expanded") === "false") fireEvent.click(head);
  fireEvent.click(await screen.findByRole("button", { name: /Onboarding screens/ }));
  await screen.findByRole("dialog");
};

test("the dialog closes once the evidence is submitted", async () => {
  const submit = jest.fn(async () => true);
  mount(submit);
  await openDialog();
  fireEvent.click(screen.getByRole("button", { name: /Submit for review|Soumettre/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(submit).toHaveBeenCalledWith("d1");
});

test("it stays open when the submission did not go through", async () => {
  const submit = jest.fn(async () => false);
  mount(submit);
  await openDialog();
  fireEvent.click(screen.getByRole("button", { name: /Submit for review|Soumettre/ }));
  await waitFor(() => expect(submit).toHaveBeenCalled());
  expect(screen.getByRole("dialog")).toBeTruthy();
});

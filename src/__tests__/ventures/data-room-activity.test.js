/**
 * @jest-environment jsdom
 *
 * The Data Room activity: a coloured timeline that STARTS FOLDED (history is
 * reference, not work) and opens on a click of its header, latest events first.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const { I18nProvider } = require("@/lib/i18n");
const DataRoomActivity = require("@/components/ventures/data-room/DataRoomActivity").default;

const history = [
  { id: 1, action: "DATA_ROOM_DOCUMENT_DELETED", details: { category: "company_overview" }, actor_name: "Chris", created_at: "2026-10-23T09:00:00Z" },
  { id: 2, action: "DATA_ROOM_DOCUMENT_VERIFIED", details: { category: "legal_corporate" }, actor_name: "Harry", created_at: "2026-10-22T14:00:00Z" },
  { id: 3, action: "DATA_ROOM_DOCUMENT_REJECTED", details: { category: "company_overview" }, actor_name: "Harry", created_at: "2026-10-22T13:00:00Z" },
  ...Array.from({ length: 6 }, (_, index) => ({ id: 10 + index, action: "DATA_ROOM_REQUIREMENT_UPDATED", details: { category: "financial" }, actor_name: "Jean", created_at: `2026-10-21T0${index}:00:00Z` })),
];

const view = (props) => render(<I18nProvider><DataRoomActivity kind="history" events={history} {...props} /></I18nProvider>);
const openCard = () => fireEvent.click(screen.getByRole("button", { name: /Data Room activity/ }));

test("shows only the latest events, with a count, and opens the rest on demand", () => {
  view();
  openCard();
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getByText("9")).toBeTruthy(); // total in the header
  fireEvent.click(screen.getByRole("button", { name: /Show all 9/ }));
  expect(screen.getAllByRole("listitem")).toHaveLength(9);
  fireEvent.click(screen.getByRole("button", { name: /Show fewer/ }));
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
});

test("each event carries what, which category, who and when", () => {
  view();
  openCard();
  expect(screen.getByText("Document verified")).toBeTruthy();
  expect(screen.getByText("Legal & Corporate")).toBeTruthy();
  expect(screen.getAllByText("Harry").length).toBeGreaterThan(0);
});

test("verdicts are coloured: verified green, rejected and deleted red", () => {
  const { container } = view();
  openCard();
  const tones = [...container.querySelectorAll(".dr-ico")].map((node) => node.className.replace("dr-ico", "").trim());
  expect(tones.slice(0, 3)).toEqual(["r", "g", "r"]); // deleted, verified, rejected
});

test("the card starts folded, and the header opens and closes it", () => {
  view();
  expect(screen.getByText("Data Room activity")).toBeTruthy();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  openCard();
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  openCard();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});

test("nothing happened yet: no empty card", () => {
  const { container } = view({ events: [] });
  expect(container.firstChild).toBeNull();
});

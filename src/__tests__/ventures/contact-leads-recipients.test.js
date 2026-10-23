/**
 * @jest-environment jsdom
 *
 * "Write to them": the founder chooses who among the Venture Leads — one or all —
 * and the request carries assignment ids only.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { I18nProvider } = require("@/lib/i18n");
const ContactLeadModal = require("@/components/ventures/support/ContactLeadModal").default;
const VentureSupportCard = require("@/components/ventures/support/VentureSupportCard").default;
const { clearResponseCache } = require("@/lib/hooks/useApi");

const harry = { id: 1, name: "Harry", email: "h@x.org", reachable: true, has_account: true, active: true, responsibility_code: "lead_manager" };
const joakh = { id: 2, name: "Joakh", email: "j@x.org", reachable: true, has_account: true, active: true, responsibility_code: "lead_manager" };
const coach = { id: 3, name: "Coach", email: "c@x.org", reachable: true, has_account: true, active: true, responsibility_code: "coach" };

let posted;
beforeEach(() => {
  clearResponseCache();
  posted = null;
  global.fetch = jest.fn((url, options = {}) => {
    if (options.method === "POST") {
      posted = JSON.parse(options.body);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, sent: 1, failed: [], reply_to_used: true }) });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, support: { current: [harry, joakh, coach], primary: { ...harry, is_primary: true }, former: [] } }),
    });
  });
});

const modal = (leads) => render(<I18nProvider><ContactLeadModal ventureId="VNT-1" leads={leads} onClose={() => {}} /></I18nProvider>);

test("by default every lead is selected and the message goes to all of them", async () => {
  modal([harry, joakh]);
  fireEvent.change(screen.getByPlaceholderText(/Write your message/), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Send message/ }));
  await waitFor(() => expect(posted).not.toBeNull());
  expect(posted).toEqual({ message: "Hello", recipients: [1, 2] });
});

test("the founder can write to just one of them", async () => {
  modal([harry, joakh]);
  fireEvent.click(screen.getByRole("checkbox", { name: /Harry/ })); // untick Harry
  fireEvent.change(screen.getByPlaceholderText(/Write your message/), { target: { value: "Hi Joakh" } });
  fireEvent.click(screen.getByRole("button", { name: /Send message/ }));
  await waitFor(() => expect(posted).not.toBeNull());
  expect(posted.recipients).toEqual([2]);
});

test("with nobody ticked the message cannot be sent", () => {
  modal([harry, joakh]);
  fireEvent.click(screen.getByRole("checkbox", { name: /All Venture Leads/ })); // untick everyone
  fireEvent.change(screen.getByPlaceholderText(/Write your message/), { target: { value: "x" } });
  expect(screen.getByRole("button", { name: /Send message/ }).disabled).toBe(true);
  expect(screen.getByText(/Choose at least one person/)).toBeTruthy();
});

test("a single lead needs no chooser", () => {
  modal([harry]);
  expect(screen.queryByRole("checkbox")).toBeNull();
});

test("the card lists the Lead Managers only: no Primary, no Also supporting, no other staff", async () => {
  render(<I18nProvider><VentureSupportCard ventureId="VNT-1" /></I18nProvider>);
  expect(await screen.findByText("Harry")).toBeTruthy();
  expect(screen.getByText("Joakh")).toBeTruthy();
  expect(screen.queryByText("Coach")).toBeNull();
  expect(screen.queryByText("Primary")).toBeNull();
  expect(screen.queryByText(/Also supporting/i)).toBeNull();
});

test('"Write to them" sits in the card header, beside the title — not on a person row', async () => {
  const { container } = render(<I18nProvider><VentureSupportCard ventureId="VNT-1" /></I18nProvider>);
  await screen.findByText("Harry");
  const button = screen.getByRole("button", { name: /Write to them/ });
  const header = container.querySelector(".stf-sech");
  expect(header.contains(button)).toBe(true);
  expect(screen.getAllByRole("button", { name: /Write to them/ })).toHaveLength(1);
  // and it still opens the recipient chooser
  fireEvent.click(button);
  expect(await screen.findByRole("checkbox", { name: /All Venture Leads/ })).toBeTruthy();
});

test("the founder is told the message went to the leads' messages — no email involved", async () => {
  modal([harry, joakh]);
  fireEvent.change(screen.getByPlaceholderText(/Write your message/), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Send message/ }));
  expect(await screen.findByText(/Message sent to 1 Venture Lead\(s\) in their messages/)).toBeTruthy();
  expect(screen.queryByText(/email/i)).toBeNull();
});

test("a lead with no ImpactOS account is flagged in the chooser and reported after sending", async () => {
  global.fetch = jest.fn((url, options = {}) =>
    options.method === "POST"
      ? Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, sent: 1, failed: [{ name: "Joakh", reason: "no_account" }] }) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) }));
  modal([harry, { ...joakh, has_account: false }]);
  expect(screen.getByText(/No ImpactOS account yet/)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText(/Write your message/), { target: { value: "Hello" } });
  fireEvent.click(screen.getByRole("button", { name: /Send message/ }));
  expect(await screen.findByText(/no ImpactOS account to receive messages: Joakh/)).toBeTruthy();
});

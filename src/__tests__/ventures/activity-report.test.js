/**
 * @jest-environment jsdom
 *
 * The "Report" button of an activity block: what it lists (with the full trail
 * of each note) and the exact requests it sends.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockConfirm = jest.fn(async () => true);
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: mockConfirm }) }));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const ActivityReport = require("@/components/ventures/journey/ActivityReport").default;

const milestone = { id: "m1", title: "Foundation & Compliance Setup" };
const activity = { id: "a1", source_ref: "FT-01", title: "Register the company" };

const notes = [
  { id: 11, title: "FT-01 · Register the company — bank visit", body: "Visited the bank.", author_name: "Awa", author_cid: "USR_1", created_at: "2026-10-12T08:30:15.000Z", updated_at: "2026-10-12T09:45:00.000Z", attachments: [{ name: "Receipt", url: "https://example.org/r.pdf" }] },
  { id: 12, title: "General remark on the milestone", body: "Other topic.", author_name: "Kofi", author_cid: "USR_2", created_at: "2026-10-13T10:00:00.000Z", updated_at: "2026-10-13T10:00:00.000Z", attachments: [] },
];

let calls;
beforeEach(() => {
  clearResponseCache();
  mockConfirm.mockClear();
  calls = [];
  global.fetch = jest.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, notes, can_post: true }) });
  });
});

const open = async () => {
  render(<I18nProvider><ActivityReport ventureId="VNT-1" milestone={milestone} activity={activity} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Report|Rapport/ }));
  await screen.findByText(/Visited the bank/);
};

test("the button says Report, not Notes", () => {
  render(<I18nProvider><ActivityReport ventureId="VNT-1" milestone={milestone} activity={activity} /></I18nProvider>);
  expect(screen.getByRole("button", { name: /Report|Rapport/ })).toBeTruthy();
  expect(screen.queryByText(/^Notes?$/)).toBeNull();
});

test("it reads the milestone's notes and shows this activity's first", async () => {
  await open();
  expect(calls[0].url).toBe("/api/ventures/VNT-1/notes?scope_type=milestone&scope_id=m1");
  expect(screen.queryByText("Other topic.")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: /milestone|jalon/i }));
  expect(await screen.findByText("Other topic.")).toBeTruthy();
});

test("each note carries its full trail: date, time, author, milestone, activity, last edit, reference", async () => {
  await open();
  const card = screen.getByText("Visited the bank.").closest("li");
  const text = card.textContent;
  for (const label of ["Created on", "Time", "Written by", "Milestone", "Activity", "Last edited", "Reference"].map((word) => new RegExp(word + "|Créé le|Heure|Rédigé par|Jalon|Activité|Dernière modification|Référence"))) {
    expect(text).toMatch(label);
  }
  expect(text).toContain("Awa");
  expect(text).toContain("#11");
  expect(text).toContain("Foundation & Compliance Setup");
  expect(card.querySelector("a").getAttribute("href")).toBe("https://example.org/r.pdf");
});

test("a new report is filed on the milestone, titled with the activity", async () => {
  await open();
  const title = screen.getByPlaceholderText(/Title|Titre/);
  expect(title.value).toBe("FT-01 · Register the company");
  fireEvent.change(screen.getByPlaceholderText(/Write the note|Écrire la note/), { target: { value: "Second visit done" } });
  fireEvent.click(screen.getByRole("button", { name: /Add report|Ajouter le rapport/ }));
  await waitFor(() => expect(calls.find((call) => call.method === "POST")).toBeTruthy());
  expect(calls.find((call) => call.method === "POST")).toMatchObject({
    url: "/api/ventures/VNT-1/notes",
    body: { title: "FT-01 · Register the company", body: "Second visit done", scope_ref_type: "milestone", scope_ref_id: "m1", attachments: [] },
  });
});

test("deleting asks first, then sends the note id", async () => {
  await open();
  fireEvent.click(screen.getAllByRole("button", { name: /Delete note|Supprimer la note/ })[0]);
  await waitFor(() => expect(calls.find((call) => call.method === "DELETE")).toBeTruthy());
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(calls.find((call) => call.method === "DELETE").body).toEqual({ note_id: 11 });
});

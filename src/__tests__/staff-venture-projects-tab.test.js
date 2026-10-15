/**
 * @jest-environment jsdom
 *
 * /staff/ventures/[id] — the Lead Manager's Project tab.
 *
 * The Project lens (every milestone, activity and deliverable of ONE Venture)
 * existed only behind /admin, and the /admin layout admits `super_admin` alone —
 * so the person who runs the Venture could not open it. The read API was already
 * open to them (`ventures.view` through the scope-aware helper, which admits the
 * Venture's own Lead Manager), so what was missing was the SURFACE, not the
 * permission.
 *
 * These tests pin the two halves of that:
 *   1. a Lead Manager gets the tab, and opening it reads the work items;
 *   2. a staff member with only a coach assignment does not get it — and cannot
 *      reach the pane by typing ?tab=projects either.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let mockSearchParams = new URLSearchParams("");
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "VNT-1" }),
  useRouter: () => ({ push: jest.fn(), replace: (...args) => mockReplace(...args) }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/lib/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ user: { cid: "C-1", name: "Lea", role: "staff" }, cid: "C-1", role: "staff" }),
}));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const StaffVentureWorkspace = require("@/app/staff/ventures/[id]/page").default;

const WORK_ITEMS = {
  success: true,
  items: [{ id: "activity:1", kind: "activity", title: "Validate demand", bucket: "upcoming" }],
  options: { owners: [], supporting: [], journeys: [], milestones: [], statuses: [], kinds: [] },
  summary: { total: 1, today: 0, upcoming: 1, overdue: 0, completed: 0 },
  today: "2026-10-06",
};

let calls;
/** `responsibility_code` of the assignment this session holds on the Venture. */
let myResponsibility;

function installFetch() {
  calls = [];
  global.fetch = jest.fn((url) => {
    const target = String(url);
    calls.push(target);
    const reply = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (target.includes("/work-items")) return reply(WORK_ITEMS);
    if (target.startsWith("/api/ventures/assigned")) {
      return reply({
        success: true,
        assignments: myResponsibility ? [{ venture_id: "VNT-1", responsibility_code: myResponsibility }] : [],
      });
    }
    if (target === "/api/ventures/VNT-1") {
      return reply({ success: true, venture: { venture_id: "VNT-1", company_name: "Kora Pay" } });
    }
    return reply({ success: true });
  });
}

const workItemReads = () => calls.filter((url) => url.includes("/work-items"));

async function renderWorkspace() {
  render(
    <I18nProvider>
      <StaffVentureWorkspace />
    </I18nProvider>,
  );
  // The header is what the first paint after loading always shows.
  await waitFor(() => expect(screen.getByText("Kora Pay")).toBeTruthy());
}

beforeEach(() => {
  jest.clearAllMocks();
  clearResponseCache();
  mockSearchParams = new URLSearchParams("");
  myResponsibility = "lead_manager";
  installFetch();
});

describe("the Lead Manager", () => {
  test("sees the Project tab on the Venture they run", async () => {
    await renderWorkspace();
    expect(screen.getByRole("button", { name: /Projects/i })).toBeTruthy();
  });

  test("clicking it asks the workspace to move to the Project tab", async () => {
    await renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Projects/i }));
    // The tab bar is URL-driven like every other tab on this page, so opening it
    // is a navigation, not local state.
    expect(mockReplace).toHaveBeenCalledWith("/staff/ventures/VNT-1?tab=projects", { scroll: false });
  });

  test("that tab reads THIS Venture's work items, and shows them", async () => {
    mockSearchParams = new URLSearchParams("tab=projects");
    await renderWorkspace();

    await waitFor(() => expect(workItemReads()).toEqual(["/api/ventures/VNT-1/work-items"]));
    expect(await screen.findByText("Validate demand")).toBeTruthy();
  });
});

describe("a staff member who does not run the Venture", () => {
  test("gets no Project tab at all", async () => {
    myResponsibility = "coach";
    await renderWorkspace();
    expect(screen.queryByRole("button", { name: /Projects/i })).toBeNull();
  });

  test("cannot reach the pane by typing the tab into the URL", async () => {
    myResponsibility = "coach";
    mockSearchParams = new URLSearchParams("tab=projects");
    await renderWorkspace();

    // It falls back to Overview: the work items are never asked for.
    expect(workItemReads()).toHaveLength(0);
    expect(screen.queryByText("Validate demand")).toBeNull();
  });
});

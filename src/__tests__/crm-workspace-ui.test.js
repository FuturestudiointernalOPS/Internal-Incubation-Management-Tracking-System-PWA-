/**
 * @jest-environment jsdom
 *
 * CRM WORKSPACE — screen tests for the Super Admin case study
 *
 * Walks the create paths of /crm the way a user does (click the button, fill
 * the form, save) and checks what reaches the API:
 *   - Organizations: the "New Organization" button opens its form, the form
 *     posts, and the list shows the rows it received;
 *   - Leads: the form cannot be sent without a person or an organization, and
 *     sends the chosen one;
 *   - Opportunities: "New Opportunity" opens a form instead of leaving the page;
 *   - Segments / lead qualification: a select sends its value, not the event.
 *
 * i18n runs without a provider, so `t(key)` returns the key itself.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockAlert = jest.fn();
jest.mock("@/components/ui/DialogProvider", () => ({
  useDialogs: () => ({ alert: mockAlert, confirm: jest.fn(), prompt: jest.fn() }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const OrganizationsPage = require("@/app/crm/organizations/page").default;
const LeadsPage = require("@/app/crm/leads/page").default;
const OpportunitiesPage = require("@/app/crm/opportunities/page").default;
const SegmentsPage = require("@/app/crm/segments/page").default;
const CrmScorePanel = require("@/components/ui/CrmScorePanel").default;

const ORG = { id: "org-1", name: "E2E-MTN Benin", type: "company", industry: "Telecoms", website: "https://mtn.example" };
const LEAD = { id: "lead-1", title: "MTN Strategic Partnership", status: "new", qualification_state: "in_review", organization_name: ORG.name, owner_name: "Super Admin" };
const PIPELINE = { id: "pipe-1", name: "Partnerships" };
const OPPORTUNITY = { id: "opp-1", name: "MTN rollout — Phase 1", pipeline_name: "Partnerships", stage_name: "Contacted", value: 15000000, currency: "XOF", probability: 40, status: "active" };

let requests;
let capabilities;

function answer(url, method) {
  if (url === "/api/me/permissions") return { success: true, effective: { crm: capabilities } };
  if (url === "/api/crm/organizations") return method === "POST" ? { success: true, organization: ORG } : { success: true, organizations: [ORG] };
  if (url === "/api/crm/leads") return method === "POST" ? { success: true, lead: LEAD } : { success: true, leads: [LEAD] };
  if (url.startsWith("/api/crm/leads/")) return { success: true, lead: { ...LEAD, qualification_state: "qualified" } };
  if (url.startsWith("/api/crm/opportunities")) {
    return method === "POST"
      ? { success: true, opportunity: OPPORTUNITY }
      : { success: true, opportunities: [OPPORTUNITY], metrics: { active_count: 1, won_count: 0, lost_count: 0, weighted_value: 6000000 } };
  }
  if (url === "/api/crm/pipelines") return { success: true, pipelines: [PIPELINE] };
  if (url === "/api/crm/segments") return method === "POST" ? { success: true, segment: {} } : { success: true, segments: [] };
  if (url === "/api/contacts") return { success: true, contacts: [{ cid: "c-1", name: "Awa Sow", email: "awa@example.com" }] };
  return { success: false };
}

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  requests = [];
  capabilities = { view: 1, create: 1, edit: 1, delete: 1, manage: 1 };
  mockAlert.mockReset();
  global.fetch = jest.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    requests.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
    return { json: async () => answer(url, method) };
  });
});

const sent = (url, method = "POST") => requests.filter((request) => request.url === url && request.method === method);

// The action buttons only render once the capabilities have been fetched.
async function click(name) {
  const button = await screen.findByRole("button", { name });
  await act(async () => {
    fireEvent.click(button);
  });
}

/** Pick a record in the searchable target select of the open dialog. */
async function pickTarget(placeholder, label) {
  const dialog = screen.getByRole("dialog");
  const trigger = await within(dialog).findByText(placeholder);
  await act(async () => {
    fireEvent.click(trigger);
  });
  const option = await within(dialog).findByText(label);
  await act(async () => {
    fireEvent.click(option);
  });
}

describe("Organizations", () => {
  test("the list shows the organizations it received", async () => {
    render(<OrganizationsPage />);
    expect(await screen.findByText("E2E-MTN Benin")).toBeTruthy();
    expect(screen.getByText("Telecoms")).toBeTruthy();
    expect(screen.getByText("crm.organizations.types.company")).toBeTruthy();
  });

  test("New Organization opens the form and saving posts it", async () => {
    render(<OrganizationsPage />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await click("crm.organizations.newOrganization");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("crm.organizations.namePlaceholder"), {
      target: { value: "E2E-MTN Benin" },
    });
    await act(async () => {
      fireEvent.submit(dialog.querySelector("form"));
    });

    expect(sent("/api/crm/organizations")).toHaveLength(1);
    expect(sent("/api/crm/organizations")[0].body.name).toBe("E2E-MTN Benin");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("without crm.create the button is not offered", async () => {
    capabilities = { view: 1 };
    render(<OrganizationsPage />);
    await screen.findByText("E2E-MTN Benin");
    expect(screen.queryByRole("button", { name: "crm.organizations.newOrganization" })).toBeNull();
  });
});

describe("Leads", () => {
  test("the list shows the leads with their qualification", async () => {
    render(<LeadsPage />);
    expect(await screen.findByText("MTN Strategic Partnership")).toBeTruthy();
    // Scope to the table: the qualification filter also offers this label as an option.
    expect(within(screen.getByRole("table")).getByText("crm.leads.qualifications.in_review")).toBeTruthy();
  });

  test("a lead is refused without a target, then sent with the chosen organization", async () => {
    render(<LeadsPage />);
    await click("crm.leads.createLead");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("crm.leads.titlePlaceholder"), {
      target: { value: "MTN Strategic Partnership" },
    });

    await act(async () => {
      fireEvent.submit(dialog.querySelector("form"));
    });
    expect(mockAlert).toHaveBeenCalledWith({ message: "crm.leads.targetRequired" });
    expect(sent("/api/crm/leads")).toHaveLength(0);

    await pickTarget("crm.target.choose.organization", "E2E-MTN Benin");
    await act(async () => {
      fireEvent.submit(dialog.querySelector("form"));
    });

    expect(sent("/api/crm/leads")).toHaveLength(1);
    expect(sent("/api/crm/leads")[0].body).toMatchObject({
      title: "MTN Strategic Partnership",
      organization_id: "org-1",
      lead_type: "partnership",
    });
  });
});

describe("Opportunities", () => {
  test("New Opportunity opens a form and saving posts the deal", async () => {
    render(<OpportunitiesPage />);
    expect(await screen.findByText("MTN rollout — Phase 1")).toBeTruthy();

    await click("crm.opportunities.newOpportunity");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("crm.opportunities.namePlaceholder"), {
      target: { value: "MTN rollout — Phase 1" },
    });
    fireEvent.change(within(dialog).getByLabelText("crm.opportunities.pipelineOnlyLabel"), {
      target: { value: "pipe-1" },
    });
    fireEvent.change(within(dialog).getByLabelText("crm.opportunities.valueLabel"), { target: { value: "15000000" } });
    fireEvent.change(within(dialog).getByLabelText("crm.opportunities.probabilityLabel"), { target: { value: "40" } });
    await pickTarget("crm.target.choose.organization", "E2E-MTN Benin");
    await act(async () => {
      fireEvent.submit(dialog.querySelector("form"));
    });

    expect(sent("/api/crm/opportunities")).toHaveLength(1);
    expect(sent("/api/crm/opportunities")[0].body).toMatchObject({
      name: "MTN rollout — Phase 1",
      pipeline_id: "pipe-1",
      organization_id: "org-1",
      value: 15000000,
      currency: "XOF",
      probability: 40,
    });
  });
});

describe("Segments and qualification", () => {
  test("a segment is saved from its form with the chosen entity type", async () => {
    render(<SegmentsPage />);
    await click("crm.intelligence.segments.createSegment");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("crm.intelligence.segments.name"), { target: { value: "Telecom partners" } });
    fireEvent.change(within(dialog).getByLabelText("crm.intelligence.segments.entityType"), { target: { value: "opportunity" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    });

    expect(sent("/api/crm/segments")[0].body).toMatchObject({ name: "Telecom partners", entity_type: "opportunity" });
  });

  test("evaluating a lead sends the qualification state", async () => {
    render(<CrmScorePanel lead={{ id: "lead-1", score: 10, qualification_state: "not_assessed" }} onUpdate={jest.fn()} />);
    await click("crm.intelligence.score.evaluate");
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("crm.intelligence.score.stateLabel"), { target: { value: "qualified" } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "common.save" }));
    });

    expect(sent("/api/crm/leads/lead-1", "PATCH")[0].body.qualification_state).toBe("qualified");
  });
});

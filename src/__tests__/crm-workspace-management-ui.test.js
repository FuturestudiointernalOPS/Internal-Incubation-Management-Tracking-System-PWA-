/**
 * @jest-environment jsdom
 *
 * CRM WORKSPACE — management screens
 *
 * The parts of the Super Admin case study that had no screen:
 *   - Pipelines: create a pipeline and add a stage to one;
 *   - Segments: save conditions and open the matching records;
 *   - Automations: save conditions and actions, read the execution log;
 *   - Organizations: link a person to an organization;
 *   - Leads: compute the score and show what it is made of.
 *
 * i18n runs without a provider, so `t(key)` returns the key itself.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react";

const mockAlert = jest.fn();
jest.mock("@/components/ui/DialogProvider", () => ({
  useDialogs: () => ({ alert: mockAlert, confirm: jest.fn(async () => true), prompt: jest.fn() }),
}));

const PipelinesPage = require("@/app/crm/pipelines/page").default;
const SegmentsPage = require("@/app/crm/segments/page").default;
const AutomationsPage = require("@/app/crm/automations/page").default;
const OrganizationsPage = require("@/app/crm/organizations/page").default;
const CrmScorePanel = require("@/components/ui/CrmScorePanel").default;

const PIPELINE = { id: "pipe-1", name: "Partnerships", is_active: true };
const STAGES = [
  { id: "st-1", name: "Contacted", position: 1, probability: 10, is_active: true, is_terminal: false },
  { id: "st-2", name: "Won", position: 2, probability: 100, is_active: true, is_terminal: true, outcome: "won" },
];
const SEGMENT = {
  id: "seg-1", name: "Hot leads", entity_type: "lead", created_at: "2026-10-01T00:00:00Z",
  conditions: [{ field: "score", operator: "greater_than_or_equal", value: 80 }],
};
const RULE = {
  id: "rule-1", name: "Follow up", entity_type: "lead", trigger_event: "lead.qualified", active: true,
  conditions: [], actions: [],
};
const ORG = { id: "org-1", name: "E2E-MTN Benin", type: "company" };

let requests;

function answer(url, method) {
  if (url === "/api/me/permissions") {
    return { success: true, effective: { crm: { view: 1, create: 1, edit: 1, delete: 1, manage: 1 } } };
  }
  if (url.startsWith("/api/crm/pipelines/pipe-1/stages")) return { success: true, stages: STAGES, stage: {} };
  if (url.startsWith("/api/crm/pipelines")) return { success: true, pipelines: [PIPELINE], pipeline: PIPELINE };
  if (url === "/api/crm/segments/seg-1" && method === "GET") {
    return { success: true, segment: SEGMENT, members: [{ id: "lead-1", title: "MTN Strategic Partnership", organization_name: ORG.name }] };
  }
  if (url.startsWith("/api/crm/segments")) return { success: true, segments: [SEGMENT], segment: SEGMENT };
  if (url === "/api/crm/automations/rule-1" && method === "GET") {
    return { success: true, executions: [{ id: "ex-1", entity_type: "lead", entity_id: "lead-1", status: "success", started_at: "2026-10-09T10:00:00Z" }] };
  }
  if (url.startsWith("/api/crm/automations")) return { success: true, rules: [RULE], rule: RULE };
  if (url === "/api/crm/organizations/org-1") return { success: true, organization: ORG, contacts: [] };
  if (url === "/api/crm/organizations") return { success: true, organizations: [ORG] };
  if (url === "/api/contacts") return { success: true, contacts: [{ cid: "c-1", name: "Awa Sow", email: "awa@example.com" }] };
  if (url === "/api/crm/contacts/c-1/organizations") return { success: true, relationship: { id: "rel-1" } };
  if (url === "/api/crm/leads/lead-1/score") {
    return {
      success: true,
      lead: { id: "lead-1", score: 70, qualification_state: "in_review" },
      breakdown: [{ key: "qualification", points: 15 }, { key: "engagement", points: 10 }],
    };
  }
  return { success: false };
}

beforeAll(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  requests = [];
  mockAlert.mockReset();
  global.fetch = jest.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    requests.push({ url, method, body: options.body ? JSON.parse(options.body) : null });
    return { json: async () => answer(url, method) };
  });
});

const sent = (url, method = "POST") => requests.filter((request) => request.url === url && request.method === method);

async function click(name, scope = screen) {
  const button = await scope.findByRole("button", { name });
  await act(async () => {
    fireEvent.click(button);
  });
}

const change = (scope, label, value) =>
  fireEvent.change(scope.getAllByLabelText(label).at(-1), { target: { value } });

describe("Pipelines", () => {
  test("a manager creates a pipeline from the screen", async () => {
    render(<PipelinesPage />);
    await click("crm.pipelines.newPipeline");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.pipelines.nameLabel", "Sponsorship");
    await act(async () => {
      fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    });

    expect(sent("/api/crm/pipelines")[0].body).toMatchObject({ name: "Sponsorship" });
  });

  test("a stage is added after the last one, with its kind", async () => {
    render(<PipelinesPage />);
    await click(/Partnerships/);
    expect(await screen.findByText("1. Contacted")).toBeTruthy();

    await click("crm.pipelines.addStage");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.pipelines.stageNameLabel", "Lost");
    change(dialog, "crm.pipelines.stageKindLabel", "lost");
    await act(async () => {
      fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    });

    expect(sent("/api/crm/pipelines/pipe-1/stages")[0].body).toEqual({
      name: "Lost", probability: 0, position: 3, is_terminal: true, outcome: "lost",
      // The stage carries its expected duration: one week by default.
      target_days: 7,
    });
  });
  test("a stage is moved earlier by sending the new order", async () => {
    render(<PipelinesPage />);
    await click(/Partnerships/);
    await click("crm.pipelines.moveStageEarlier — Won");

    expect(sent("/api/crm/pipelines/pipe-1/stages", "PATCH")[0].body).toEqual({ order: ["st-2", "st-1"] });
  });
});

describe("Segments", () => {
  test("conditions are saved with the segment", async () => {
    render(<SegmentsPage />);
    await click("crm.intelligence.segments.createSegment");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.intelligence.segments.name", "Qualified leads");
    await click("crm.intelligence.conditions.add", dialog);
    change(dialog, "crm.intelligence.conditions.fieldLabel", "score");
    change(dialog, "crm.intelligence.conditions.operatorLabel", "greater_than");
    change(dialog, "crm.intelligence.conditions.valueLabel", "60");
    await click("common.save", dialog);

    expect(sent("/api/crm/segments")[0].body.conditions).toEqual([
      { field: "score", operator: "greater_than", value: 60 },
    ]);
  });

  test("a segment lists the records that match it", async () => {
    render(<SegmentsPage />);
    await click("crm.intelligence.segments.viewRecords");
    expect(await screen.findByText("MTN Strategic Partnership")).toBeTruthy();
  });
});

describe("Automations", () => {
  test("a rule is saved with its conditions and actions", async () => {
    render(<AutomationsPage />);
    await click("crm.intelligence.automations.newRule");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.intelligence.automations.name", "Task on qualification");
    await click("crm.intelligence.conditions.add", dialog);
    change(dialog, "crm.intelligence.conditions.valueLabel", "qualified");
    await click("crm.intelligence.actions.add", dialog);
    change(dialog, "crm.intelligence.actions.titleLabel", "Send partnership deck");
    await click("common.save", dialog);

    expect(sent("/api/crm/automations")[0].body).toMatchObject({
      name: "Task on qualification",
      trigger_event: "lead.qualified",
      conditions: [{ field: "status", operator: "equals", value: "qualified" }],
      actions: [{ type: "create_task", payload: { title: "Send partnership deck", priority: "medium" } }],
    });
  });

  test("an opportunity rule is offered the opportunity triggers", async () => {
    render(<AutomationsPage />);
    await click("crm.intelligence.automations.newRule");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.intelligence.automations.name", "Celebrate a win");
    change(dialog, "crm.intelligence.automations.entityType", "opportunity");
    change(dialog, "crm.intelligence.automations.triggerEvent", "opportunity.won");
    await click("common.save", dialog);

    expect(sent("/api/crm/automations")[0].body).toMatchObject({
      entity_type: "opportunity",
      trigger_event: "opportunity.won",
    });
  });

  test("the execution log of a rule can be read", async () => {
    render(<AutomationsPage />);
    await click("crm.intelligence.automations.executions");
    expect(await screen.findByText("crm.intelligence.automations.executionStatus.success")).toBeTruthy();
  });
});

describe("Organizations and scoring", () => {
  test("a person is linked to an organization", async () => {
    render(<OrganizationsPage />);
    await click("crm.organizations.people");
    const dialog = within(screen.getByRole("dialog"));
    expect(await dialog.findByText("crm.relationships.noPeople")).toBeTruthy();

    const trigger = await dialog.findByText("crm.target.choose.contact");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const option = await dialog.findByText("Awa Sow — awa@example.com");
    await act(async () => {
      fireEvent.click(option);
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    });

    expect(sent("/api/crm/contacts/c-1/organizations")[0].body).toMatchObject({
      organization_id: "org-1",
      relationship_type: "works_for",
    });
  });

  test("an organization is edited, then deleted after confirmation", async () => {
    render(<OrganizationsPage />);
    await click("crm.organizations.editOrganization — E2E-MTN Benin");
    const dialog = within(screen.getByRole("dialog"));
    change(dialog, "crm.organizations.industryPlaceholder", "Telecoms");
    await act(async () => {
      fireEvent.submit(screen.getByRole("dialog").querySelector("form"));
    });
    expect(sent("/api/crm/organizations/org-1", "PATCH")[0].body).toMatchObject({
      name: "E2E-MTN Benin",
      industry: "Telecoms",
    });

    await click("crm.organizations.deleteOrganization — E2E-MTN Benin");
    expect(sent("/api/crm/organizations/org-1", "DELETE")).toHaveLength(1);
  });

  test("the computed score shows what it is made of", async () => {
    const onUpdate = jest.fn();
    render(<CrmScorePanel lead={{ id: "lead-1", score: 0, qualification_state: "in_review" }} onUpdate={onUpdate} />);
    await click("crm.intelligence.score.compute");

    expect(sent("/api/crm/leads/lead-1/score")).toHaveLength(1);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ score: 70 }));
    expect(screen.getByText("crm.intelligence.score.rules.qualification")).toBeTruthy();
    expect(screen.getByText("+15")).toBeTruthy();
  });
});

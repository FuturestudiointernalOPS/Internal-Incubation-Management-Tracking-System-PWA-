jest.mock("@/models/communications", () => ({
  insertCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaignSteps: jest.fn(),
  getCampaignWithCounts: jest.fn(),
  getCampaignSteps: jest.fn(),
  getCampaignContacts: jest.fn(),
  insertCampaignSteps: jest.fn(),
  insertCampaignContacts: jest.fn(),
  getCampaignContactCids: jest.fn(),
  deleteCampaignContacts: jest.fn(),
}));

import {
  insertCampaign,
  updateCampaign,
  deleteCampaignSteps,
  getCampaignWithCounts,
  getCampaignSteps,
  getCampaignContacts,
  insertCampaignSteps,
  insertCampaignContacts,
  getCampaignContactCids,
  deleteCampaignContacts,
} from "@/models/communications";
import {
  campaignStepRows,
  addCampaignSteps,
  addCampaignContacts,
  syncCampaignAudience,
  createCampaign,
  updateCampaignDefinition,
  withDeliveredCounts,
  loadCampaignDetail,
} from "@/services/communications/campaigns";

beforeEach(() => {
  jest.resetAllMocks();
  insertCampaign.mockResolvedValue({ rows: [{ id: 12 }] });
  updateCampaign.mockResolvedValue(undefined);
  deleteCampaignSteps.mockResolvedValue(undefined);
  insertCampaignSteps.mockResolvedValue(undefined);
  insertCampaignContacts.mockResolvedValue(undefined);
  deleteCampaignContacts.mockResolvedValue(undefined);
  getCampaignContactCids.mockResolvedValue({ rows: [] });
});

describe("campaignStepRows", () => {
  it("converts days to hours", () => {
    const [row] = campaignStepRows([{ subject: "S", body: "B", wait_type: "days", delay_days: 2 }]);
    expect(row).toEqual({ subject: "S", body: "B", delayHours: 48 });
  });

  it("keeps hours as they are", () => {
    const [row] = campaignStepRows([{ wait_type: "hours", delay_hours: 5 }]);
    expect(row.delayHours).toBe(5);
  });

  it("rounds minutes to the nearest hour", () => {
    const rows = campaignStepRows([
      { wait_type: "minutes", delay_minutes: 90 },
      { wait_type: "minutes", delay_minutes: 20 },
      { wait_type: "minutes", delay_minutes: 30 },
    ]);
    expect(rows.map((row) => row.delayHours)).toEqual([2, 0, 1]);
  });

  it("only reads the field that matches wait_type", () => {
    const [row] = campaignStepRows([
      { wait_type: "days", delay_days: 1, delay_hours: 7, delay_minutes: 600 },
    ]);
    expect(row.delayHours).toBe(24);
  });

  it("falls back to 0 for a missing or unknown wait", () => {
    const rows = campaignStepRows([
      { wait_type: "days" },
      { wait_type: "weeks", delay_days: 3 },
      {},
    ]);
    expect(rows.map((row) => row.delayHours)).toEqual([0, 0, 0]);
  });
});

describe("addCampaignSteps / addCampaignContacts", () => {
  it("does nothing for a missing or empty list", async () => {
    await addCampaignSteps(1, undefined);
    await addCampaignSteps(1, []);
    await addCampaignContacts(1, undefined);
    await addCampaignContacts(1, []);
    expect(insertCampaignSteps).not.toHaveBeenCalled();
    expect(insertCampaignContacts).not.toHaveBeenCalled();
  });

  it("inserts the converted step rows", async () => {
    await addCampaignSteps(1, [{ subject: "S", body: "B", wait_type: "hours", delay_hours: 3 }]);
    expect(insertCampaignSteps).toHaveBeenCalledWith(1, [
      { subject: "S", body: "B", delayHours: 3 },
    ]);
  });

  it("inserts the contacts", async () => {
    await addCampaignContacts(1, ["a", "b"]);
    expect(insertCampaignContacts).toHaveBeenCalledWith(1, ["a", "b"]);
  });
});

describe("syncCampaignAudience", () => {
  it("adds only the new identities and removes only the dropped ones", async () => {
    getCampaignContactCids.mockResolvedValue({
      rows: [{ contact_cid: "a" }, { contact_cid: "b" }],
    });
    await syncCampaignAudience(7, ["b", "c"]);
    expect(insertCampaignContacts).toHaveBeenCalledWith(7, ["c"]);
    expect(deleteCampaignContacts).toHaveBeenCalledWith(7, ["a"]);
  });

  it("neither inserts nor deletes when the audience is unchanged", async () => {
    getCampaignContactCids.mockResolvedValue({ rows: [{ contact_cid: "a" }] });
    await syncCampaignAudience(7, ["a"]);
    expect(insertCampaignContacts).not.toHaveBeenCalled();
    expect(deleteCampaignContacts).not.toHaveBeenCalled();
  });
});

describe("createCampaign", () => {
  it("inserts the campaign, then its steps and contacts, and returns the id", async () => {
    const id = await createCampaign({
      name: "Spring",
      formId: 3,
      steps: [{ subject: "S", body: "B", wait_type: "hours", delay_hours: 1 }],
      cids: ["a"],
    });
    expect(id).toBe(12);
    expect(insertCampaign).toHaveBeenCalledWith("Spring", 3);
    expect(insertCampaignSteps).toHaveBeenCalledWith(12, [
      { subject: "S", body: "B", delayHours: 1 },
    ]);
    expect(insertCampaignContacts).toHaveBeenCalledWith(12, ["a"]);
  });

  it("accepts a campaign without steps or contacts", async () => {
    await expect(createCampaign({ name: "Bare" })).resolves.toBe(12);
    expect(insertCampaignSteps).not.toHaveBeenCalled();
    expect(insertCampaignContacts).not.toHaveBeenCalled();
  });
});

describe("updateCampaignDefinition", () => {
  it("always updates the main info, mapping form_id to formId", async () => {
    await updateCampaignDefinition(5, { name: "New", form_id: 9 });
    expect(updateCampaign).toHaveBeenCalledWith({ id: 5, name: "New", formId: 9 });
    expect(deleteCampaignSteps).not.toHaveBeenCalled();
    expect(getCampaignContactCids).not.toHaveBeenCalled();
  });

  it("replaces the steps: delete first, then insert", async () => {
    await updateCampaignDefinition(5, {
      name: "N",
      steps: [{ subject: "S", body: "B", wait_type: "hours", delay_hours: 2 }],
    });
    expect(deleteCampaignSteps).toHaveBeenCalledWith(5);
    expect(insertCampaignSteps).toHaveBeenCalledWith(5, [
      { subject: "S", body: "B", delayHours: 2 },
    ]);
    expect(deleteCampaignSteps.mock.invocationCallOrder[0]).toBeLessThan(
      insertCampaignSteps.mock.invocationCallOrder[0],
    );
  });

  it("clears the steps when given an empty list", async () => {
    await updateCampaignDefinition(5, { name: "N", steps: [] });
    expect(deleteCampaignSteps).toHaveBeenCalledWith(5);
    expect(insertCampaignSteps).not.toHaveBeenCalled();
  });

  it("syncs the audience when cids is present", async () => {
    await updateCampaignDefinition(5, { name: "N", cids: ["a"] });
    expect(getCampaignContactCids).toHaveBeenCalledWith(5);
    expect(insertCampaignContacts).toHaveBeenCalledWith(5, ["a"]);
  });
});

describe("withDeliveredCounts", () => {
  it("stamps every step with the campaign-wide non-pending count", () => {
    const steps = [{ id: 1 }, { id: 2 }];
    const contacts = [
      { status: "pending" },
      { status: "completed" },
      { status: "sent" },
    ];
    expect(withDeliveredCounts(steps, contacts)).toEqual([
      { id: 1, delivered_count: 2 },
      { id: 2, delivered_count: 2 },
    ]);
  });

  it("counts 0 when every contact is pending or there is none", () => {
    expect(withDeliveredCounts([{ id: 1 }], [{ status: "pending" }])).toEqual([
      { id: 1, delivered_count: 0 },
    ]);
    expect(withDeliveredCounts([{ id: 1 }], [])).toEqual([{ id: 1, delivered_count: 0 }]);
  });
});

describe("loadCampaignDetail", () => {
  it("returns null without reading steps or contacts when the campaign is missing", async () => {
    getCampaignWithCounts.mockResolvedValue({ rows: [] });
    await expect(loadCampaignDetail(5)).resolves.toBeNull();
    expect(getCampaignSteps).not.toHaveBeenCalled();
    expect(getCampaignContacts).not.toHaveBeenCalled();
  });

  it("merges the campaign, its stamped steps and its contacts", async () => {
    getCampaignWithCounts.mockResolvedValue({ rows: [{ id: 5, name: "Spring" }] });
    getCampaignSteps.mockResolvedValue({ rows: [{ id: 1 }] });
    getCampaignContacts.mockResolvedValue({
      rows: [{ status: "pending" }, { status: "completed" }],
    });
    await expect(loadCampaignDetail(5)).resolves.toEqual({
      id: 5,
      name: "Spring",
      steps: [{ id: 1, delivered_count: 1 }],
      contacts: [{ status: "pending" }, { status: "completed" }],
    });
  });
});

/**
 * Behaviour of the operational-report use case (service layer).
 *
 * The decisions behind `/api/op-reports` are exercised with the repository
 * mocked, so no database is needed: who may read whose reports, the
 * create-or-update upsert, and the rule that an empty `projects_tasks` never
 * erases the stored (auto-generated) task list.
 */

jest.mock("@/models/adminOps", () => ({
  getOpReportId: jest.fn(),
  insertOpReport: jest.fn(),
  listOpReports: jest.fn(),
  updateOpReport: jest.fn(),
}));

const {
  getOpReportId,
  insertOpReport,
  listOpReports,
  updateOpReport,
} = require("@/models/adminOps");
const { listReports, saveReport } = require("@/services/dashboard/opReports");

const EMPTY_FILTERS = {
  user_id: null,
  report_type: null,
  week_number: null,
  year: null,
  workspace: null,
  context_type: null,
  context_id: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  listOpReports.mockResolvedValue({ rows: [] });
  getOpReportId.mockResolvedValue({ rows: [] });
  insertOpReport.mockResolvedValue({ rows: [{ id: 42 }] });
  updateOpReport.mockResolvedValue({ rows: [] });
});

describe("listReports — who may read whose reports", () => {
  test("a staff member asking for someone else is refused, and no read runs", async () => {
    const result = await listReports({
      session: { role: "staff", cid: "staff-1" },
      filters: { ...EMPTY_FILTERS, user_id: "staff-2" },
    });
    expect(result.status).toBe(403);
    expect(result.body.success).toBe(false);
    expect(listOpReports).not.toHaveBeenCalled();
  });

  test("a staff member asking for their own reports is scoped to themselves", async () => {
    const result = await listReports({
      session: { role: "staff", cid: "staff-1" },
      filters: { ...EMPTY_FILTERS, user_id: "staff-1" },
    });
    expect(result.status).toBe(200);
    expect(listOpReports).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: false, sessionCid: "staff-1" }),
    );
  });

  test("a staff member with no user_id is allowed (the repository still scopes the read)", async () => {
    const result = await listReports({
      session: { role: "staff", cid: "staff-1" },
      filters: { ...EMPTY_FILTERS },
    });
    expect(result.status).toBe(200);
    expect(listOpReports).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: false, sessionCid: "staff-1" }),
    );
  });

  test("a super admin may read another user's reports", async () => {
    const result = await listReports({
      session: { role: "super_admin", cid: "admin-1" },
      filters: { ...EMPTY_FILTERS, user_id: "staff-2" },
    });
    expect(result.status).toBe(200);
    expect(listOpReports).toHaveBeenCalledWith(
      expect.objectContaining({ isSuperAdmin: true, user_id: "staff-2" }),
    );
  });

  test("the answer carries the rows the repository returned", async () => {
    listOpReports.mockResolvedValue({ rows: [{ id: 7 }] });
    const result = await listReports({
      session: { role: "staff", cid: "staff-1" },
      filters: { ...EMPTY_FILTERS },
    });
    expect(result.body).toEqual({ success: true, reports: [{ id: 7 }] });
  });
});

describe("saveReport — required fields", () => {
  test("a missing required field is a 400 and touches nothing", async () => {
    const result = await saveReport({
      user_id: "staff-1",
      week_number: 12,
      year: 2026,
    });
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
    expect(getOpReportId).not.toHaveBeenCalled();
    expect(insertOpReport).not.toHaveBeenCalled();
  });
});

describe("saveReport — create", () => {
  test("no existing report inserts one and reports the new id", async () => {
    const result = await saveReport({
      user_id: "staff-1",
      user_name: "A",
      user_role: "staff",
      report_type: "standup",
      week_number: 12,
      year: 2026,
      status: "submitted",
    });
    expect(insertOpReport).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, id: 42, action: "created" });
  });

  test("an intern's new report lands in the interns workspace; everyone else in main", async () => {
    await saveReport({
      user_id: "i-1",
      user_role: "intern",
      report_type: "standup",
      week_number: 12,
      year: 2026,
    });
    expect(insertOpReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspace: "interns" }),
    );

    insertOpReport.mockClear();
    await saveReport({
      user_id: "s-1",
      user_role: "staff",
      report_type: "standup",
      week_number: 12,
      year: 2026,
    });
    expect(insertOpReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspace: "main" }),
    );
  });

  test("a row without an id falls back to lastInsertRowid", async () => {
    insertOpReport.mockResolvedValue({ rows: [], lastInsertRowid: 99 });
    const result = await saveReport({
      user_id: "staff-1",
      report_type: "retro",
      week_number: 1,
      year: 2026,
    });
    expect(result.body.id).toBe(99);
  });
});

describe("saveReport — update", () => {
  test("an existing report is updated in place", async () => {
    getOpReportId.mockResolvedValue({ rows: [{ id: 5 }] });
    const result = await saveReport({
      user_id: "staff-1",
      report_type: "standup",
      week_number: 12,
      year: 2026,
      status: "submitted",
      additional_notes: "note",
    });
    expect(insertOpReport).not.toHaveBeenCalled();
    expect(updateOpReport).toHaveBeenCalledTimes(1);
    const [fields, args] = updateOpReport.mock.calls[0];
    expect(fields).toEqual([
      "additional_notes = ?",
      "status = ?",
      "updated_at = CURRENT_TIMESTAMP",
    ]);
    expect(args).toEqual(["note", "submitted", 5]);
    expect(result.body).toEqual({ success: true, id: 5, action: "updated" });
  });

  test("an empty projects_tasks never erases the stored task list", async () => {
    getOpReportId.mockResolvedValue({ rows: [{ id: 5 }] });
    await saveReport({
      user_id: "staff-1",
      report_type: "standup",
      week_number: 12,
      year: 2026,
      projects_tasks: "   ",
    });
    // The only would-be field is the timestamp, which alone is not worth a write.
    expect(updateOpReport).not.toHaveBeenCalled();
  });

  test("a populated projects_tasks is kept", async () => {
    getOpReportId.mockResolvedValue({ rows: [{ id: 5 }] });
    await saveReport({
      user_id: "staff-1",
      report_type: "standup",
      week_number: 12,
      year: 2026,
      projects_tasks: "Task A",
    });
    const [fields, args] = updateOpReport.mock.calls[0];
    expect(fields).toEqual([
      "projects_tasks = ?",
      "updated_at = CURRENT_TIMESTAMP",
    ]);
    expect(args).toEqual(["Task A", 5]);
  });

  test("an update with nothing but the timestamp writes nothing", async () => {
    getOpReportId.mockResolvedValue({ rows: [{ id: 5 }] });
    const result = await saveReport({
      user_id: "staff-1",
      report_type: "standup",
      week_number: 12,
      year: 2026,
    });
    expect(updateOpReport).not.toHaveBeenCalled();
    expect(result.body.action).toBe("updated");
  });
});

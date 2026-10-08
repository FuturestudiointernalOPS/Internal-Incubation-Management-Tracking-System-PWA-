/**
 * Regression — the dashboard profile query must load the ticket range.
 *
 * The recommendation scorer weights ticket-size fit (15 points) by reading
 * `ticket_size_min` / `ticket_size_max` off the profile row. Those columns live
 * on the preferences table, so a profile query that joins the preferences but
 * omits them makes the scorer read `undefined` and silently drop the component.
 * This pins the selected columns.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
  initDb: jest.fn(async () => {}),
}));

const db = require("@/lib/db").default;
const { getInvestorDashboardProfile } = require("@/models/investor/dashboardsAndKpis");

describe("investor dashboard profile query", () => {
  it("selects the ticket range the scorer needs", async () => {
    db.execute.mockResolvedValue({ rows: [] });

    await getInvestorDashboardProfile("CID");

    const sql = db.execute.mock.calls[0][0].sql;
    expect(sql).toContain("ipr.ticket_size_min");
    expect(sql).toContain("ipr.ticket_size_max");
  });
});

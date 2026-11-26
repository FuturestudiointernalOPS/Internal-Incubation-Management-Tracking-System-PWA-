/**
 * Venture Manager home — the milestone read.
 *
 * The KPIs and the urgency queue are built from this list, so an ARCHIVED
 * milestone must never reach them: a Venture that archived old work would
 * otherwise read as busier — or as blocked — than it really is.
 *
 * The archive filter is written like the journey-stage read next door:
 * archive-aware, with an unfiltered fallback for a database that predates the
 * column (the first query rejects, the second still answers).
 */
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn() },
}));

const execute = require("@/lib/db").default.execute;
const { selectMilestonesForLeadVentures } = require("@/models/leadManagerDashboard");

beforeEach(() => execute.mockReset());

test("an archived milestone never reaches the dashboard", async () => {
  execute.mockResolvedValue({ rows: [] });

  await selectMilestonesForLeadVentures(["db-1", "db-2"]);

  expect(execute).toHaveBeenCalledTimes(1);
  const [{ sql, args }] = execute.mock.calls[0];
  expect(sql).toContain("COALESCE(m.is_archived, FALSE) = FALSE");
  expect(args).toEqual(["db-1", "db-2"]);
});

test("a database without the column still answers, unfiltered", async () => {
  execute
    .mockRejectedValueOnce(new Error('column "is_archived" does not exist'))
    .mockResolvedValueOnce({ rows: [{ id: 1 }] });

  const result = await selectMilestonesForLeadVentures(["db-1"]);

  expect(execute).toHaveBeenCalledTimes(2);
  expect(String(execute.mock.calls[1][0].sql)).not.toContain("is_archived");
  expect(result.rows).toHaveLength(1);
});

test("no Venture ids means no query at all", async () => {
  const result = await selectMilestonesForLeadVentures([]);

  expect(execute).not.toHaveBeenCalled();
  expect(result.rows).toEqual([]);
});

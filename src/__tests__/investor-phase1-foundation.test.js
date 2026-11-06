jest.mock("@/lib/db", () => ({ __esModule: true, default: { execute: jest.fn(), transaction: jest.fn() } }));
jest.mock("@/models/adminOps/reportsAndErrors", () => ({ insertErrorLog: jest.fn() }));
jest.mock("@/models/fxRateStore", () => ({ selectEuroRates: jest.fn(), selectLatestEuroRateDate: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { error: jest.fn() } }));
const db = require("@/lib/db").default;
const { insertErrorLog } = require("@/models/adminOps/reportsAndErrors");
const { logger } = require("@/lib/logger");
const { insertActivityEvent } = require("@/models/investor/activityLog");
const { emitInvestorEvent, dedupeKeyFor } = require("@/services/investor/activity");
const { searchInvestorVentures, countInvestorVentureSearch } = require("@/models/investor/venturesAndUpdates");
const metrics = require("@/models/investor/metrics");
const {
  investorCampaign,
  investorRelationship,
  investorVentureCard,
  investorWatchlistRow,
} = require("@/services/investor/dto");
const { projectInvestorResponse } = require("@/services/investor/responsePrivacy");
const { setInvestorVisibilityMode } = require("@/services/investor/visibility");
const ID = "7815c0bf-36f4-400d-8989-e2e03c7118c6";
beforeEach(() => {
  jest.clearAllMocks();
  db.execute.mockResolvedValue({ rows: [{ event_id: "recorded" }] });
  insertErrorLog.mockResolvedValue({ rows: [{ id: 1 }] });
});

test("UUID references never enter BIGINT columns; canonical metadata cannot be forged", async () => {
  const result = await insertActivityEvent({ event_id: "evt", investor_id: ID, related_id: ID,
    metadata: { investor_ref: "forged", related_ref: "forged", is_test: true }, is_test: false, event_type: "pipeline_added" });
  const args = db.execute.mock.calls[0][0].args;
  expect(args[3]).toBeNull(); expect(args[5]).toBeNull();
  expect(JSON.parse(args[14])).toEqual({ investor_ref: ID, related_ref: ID, is_test: false });
  expect(result).toBe("recorded");
});
test("oversized numeric references do not overflow BIGINT", async () => {
  await insertActivityEvent({ investor_id: "99999999999999999999999999", event_type: "pipeline_added" });
  expect(db.execute.mock.calls[0][0].args[3]).toBeNull();
});
test("historic numeric references remain supported without a migration", async () => {
  await insertActivityEvent({ investor_id: 42, event_type: "pipeline_added" });
  expect(db.execute.mock.calls[0][0].args[3]).toBe("42");
});
test("a duplicate does not falsely report a newly inserted event", async () => {
  db.execute.mockResolvedValue({ rows: [] });
  expect(await insertActivityEvent({ event_type: "login" })).toBeNull();
});
test("repeat view identity does not change across a half-hour boundary", () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date("2026-11-05T10:29:59Z"));
    const key = dedupeKeyFor({ eventType: "venture_viewed", actorId: ID, target: "venture" });
    jest.setSystemTime(new Date("2026-11-05T10:30:01Z"));
    expect(dedupeKeyFor({ eventType: "venture_viewed", actorId: ID, target: "venture" })).toBe(key);
    expect(dedupeKeyFor({ eventType: "venture_viewed", actorId: ID, target: "another" })).not.toBe(key);
  } finally { jest.useRealTimers(); }
});
test.each(["search_used", "deck_opened", "list_viewed", "pipeline_added"])("%s remains a distinct action", eventType => {
  expect(dedupeKeyFor({ eventType, actorId: ID, target: "venture" })).toBeNull();
});
test.each([true, false])("rolling view check locks before looking up history (duplicate=%p)", async duplicate => {
  const query = jest.fn(async sql => ({ rows: sql.startsWith("SELECT event_id")
    ? (duplicate ? [{ event_id: "old" }] : [])
    : sql.startsWith("INSERT") ? [{ event_id: "new" }] : [] }));
  db.transaction.mockImplementation(fn => fn(query));
  const result = await insertActivityEvent({ event_type: "venture_viewed", actor_id: "MEMBER-DEMO", venture_id: "VNT-DEMO", dedupe_key: "stable" });
  const sql = query.mock.calls.map(args => args[0]);
  expect(sql[0]).toContain("READ COMMITTED");
  expect(sql[1]).toContain("pg_advisory_xact_lock");
  expect(sql[2]).toContain("clock_timestamp() - INTERVAL '30 minutes'");
  expect(sql.some(value => value.startsWith("INSERT"))).toBe(!duplicate);
  expect(result).toBe(duplicate ? null : "new");
});
test("failed logging enters the Errors register without rejecting the primary action", async () => {
  db.execute.mockRejectedValue(new Error("PRIVATE SQL ERROR"));
  expect(await emitInvestorEvent({ session: { cid: "MEMBER-DEMO" }, eventType: "pipeline_added" })).toBeNull();
  expect(insertErrorLog).toHaveBeenCalledWith(expect.objectContaining({ message: "Investor activity write failed" }), "investor", "investor_activity_append");
});
test("failure of the Errors register also remains secondary", async () => {
  db.execute.mockRejectedValue(new Error("private"));
  insertErrorLog.mockRejectedValue(new Error("private"));
  await expect(emitInvestorEvent({ session: {}, eventType: "pipeline_added" })).resolves.toBeNull();
  expect(logger.error).toHaveBeenCalledWith("investor_activity_register_failed", { eventType: "pipeline_added" });
});
test("staff events and test identity are snapshotted on the server", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{ id: ID, is_test: true, visibility_mode: "full_pipeline" }] });
  await emitInvestorEvent({ session: { cid: "STAFF-DEMO", role: "staff" }, eventType: "pipeline_added" });
  const args = db.execute.mock.calls[1][0].args;
  expect(args[6]).toBe("studio");
  expect(JSON.parse(args[14]).is_test).toBe(true);
});
test("mode filtering is applied equally before both counting and pagination", async () => {
  const filters = { search: "demo", stage: "SECRET-STAGE", visibilityMode: "deal_flow_only", limit: 10, offset: 10 };
  await countInvestorVentureSearch(filters); await searchInvestorVentures(filters);
  for (const [statement] of db.execute.mock.calls) {
    expect(statement.sql).toContain("EXISTS (SELECT 1 FROM deal_flow_entries");
    expect(statement.sql).toContain("d.status = 'published'");
    expect(statement.args).not.toContain("%SECRET-STAGE%");
  }
  expect(db.execute.mock.calls[1][0].args.slice(-2)).toEqual([10, 10]);
});
test("full-pipeline search preserves the optional stage filter", async () => {
  await countInvestorVentureSearch({ stage: "Seed", visibilityMode: "full_pipeline" });
  expect(db.execute.mock.calls[0][0].args).toContain("%Seed%");
});
test.each(["countActivityByType", "selectConversionPairs", "countActiveInvestors", "getEngagementStats", "getStageTransitions", "getInterestPairs", "getRescheduleStats", "getLossReasons"])("%s uses canonical IDs and excludes staff/test log traffic", async name => {
  await metrics[name]();
  const sql = db.execute.mock.calls[0][0].sql;
  expect(sql).toContain("metadata->>'investor_ref'");
  expect(sql).toContain("actor_type = 'investor'");
  expect(sql).toContain("metadata->>'is_test'");
});
test("campaign and relationship DTOs omit internal nested information", () => {
  expect(investorCampaign({ id: "campaign", review_notes: "PRIVATE", investor_count: 3 })).toEqual({ id: "campaign" });
  expect(investorRelationship({ id: "workspace", internal_notes: "PRIVATE", next_meetings: [{ id: "meeting", notes: "PRIVATE" }] }))
    .toEqual({ id: "workspace", next_meetings: [{ id: "meeting" }] });
});
test("founder cards expose existing aggregate facts without names or contact details", () => {
  const card = investorVentureCard({ id: "venture", founders_count: 2,
    founders_countries: ["Benin", { email: "PRIVATE" }], founder_name: "PRIVATE", phone: "PRIVATE" });
  expect(card.founders).toBe(2);
  expect(card.founders_countries).toEqual(["Benin"]);
  expect(JSON.stringify(card)).not.toContain("PRIVATE");
});
test("venture cards expose only a published deck id, never its stored file reference", () => {
  const card = investorVentureCard({
    id: "venture",
    deck_id: 17,
    deck_version: 2,
    file_ref: "deal-flow/17/private.pdf",
  });
  expect(card.deck).toEqual({ id: 17, version: 2 });
  expect(JSON.stringify(card)).not.toContain("private.pdf");
});
test("watchlist DTOs expose a published deck id without storage details", () => {
  const row = investorWatchlistRow({
    id: 1,
    venture_id: "venture",
    deal_flow_id: 8,
    deck_id: 17,
    deck_version: 2,
    file_ref: "deal-flow/8/private.pdf",
  });
  expect(row.deck).toEqual({ id: 17, version: 2 });
  expect(JSON.stringify(row)).not.toContain("private.pdf");
});
test("dashboard response privacy keeps only the published deck identifier", () => {
  const result = projectInvestorResponse({
    success: true,
    recommendations: [{
      id: "venture",
      deck: { id: 17, version: 2, file_ref: "deal-flow/8/private.pdf" },
      file_ref: "deal-flow/8/private.pdf",
    }],
  }, "dashboard", "deal_flow_only");
  expect(result.recommendations[0].deck).toEqual({ id: 17, version: 2 });
  expect(JSON.stringify(result)).not.toContain("private.pdf");
});
test("an investor cannot promote their own visibility even if a controller omits a check", async () => {
  const result = await setInvestorVisibilityMode({ investorId: ID, mode: "full_pipeline", session: { cid: "MEMBER-DEMO", role: "member" } });
  expect(result).toMatchObject({ ok: false, status: 403 });
  expect(db.transaction).not.toHaveBeenCalled();
});
test("the previous mode is read after locking; client-supplied oldMode is ignored", async () => {
  const query = jest.fn(async sql => ({ rows: sql.startsWith("UPDATE")
    ? [{ id: ID, visibility_mode: "full_pipeline" }]
    : sql.startsWith("SELECT visibility_mode") ? [{ visibility_mode: "deal_flow_only" }] : [] }));
  db.transaction.mockImplementation(fn => fn(query));
  db.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ event_id: "mode-change" }] });
  const result = await setInvestorVisibilityMode({ investorId: ID, mode: "full_pipeline", oldMode: "forged", session: { cid: "STAFF-DEMO", role: "staff" } });
  expect(result.ok).toBe(true);
  expect(query.mock.calls[1][0]).toContain("FOR UPDATE");
  expect(query.mock.calls[2][0]).toContain("SELECT visibility_mode");
  const metadata = JSON.parse(db.execute.mock.calls[1][0].args[14]);
  expect(metadata.old).toBe("deal_flow_only");
  expect(metadata.investor_ref).toBe(ID);
});

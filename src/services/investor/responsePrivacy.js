import { investorCampaign, investorPipelineRow, investorRelationship, investorWatchlistRow } from "./dto";
import { toInvestorSelfProfile } from "./profilePrivacy";

// Contracts for legacy self-service endpoints. Unknown fields, including newly
// added internal columns, do not propagate through SELECT/RETURNING *.
const FIELDS = {
  request: ["id", "workspace_id", "title", "description", "status", "due_date", "created_at", "updated_at"],
  note: ["id", "pipeline_id", "content", "created_at", "updated_at"],
  workspace: ["id", "pipeline_id", "status", "created_at", "updated_at"],
  document: ["id", "request_id", "file_name", "file_size", "file_type", "uploaded_at", "created_at", "file_data"],
  meeting: ["id", "workspace_id", "meeting_type", "scheduled_date", "scheduled_time", "start_at", "timezone", "duration_minutes", "location", "video_link", "status"],
  decision: ["id", "pipeline_id", "venture_id", "venture_name", "decision_type", "investment_amount", "decision_date", "created_at"],
};
const pick = (row, fields) => row && typeof row === "object"
  ? Object.fromEntries(fields.filter(key => Object.hasOwn(row, key)
    && (row[key] === null || ["string", "boolean"].includes(typeof row[key])
      || typeof row[key] === "number" && Number.isFinite(row[key]) || row[key] instanceof Date))
    .map(key => [key, row[key]])) : null;
const many = (rows, mapper) => Array.isArray(rows) ? rows.map(mapper) : [];

/** Own-scope guards in the original controller/service must still run first. */
export function projectInvestorResponse(payload, surface, mode) {
  const result = { success: payload.success };
  for (const key of ["action", "id"]) {
    if (["string", "number"].includes(typeof payload[key])) result[key] = payload[key];
  }
  const pipeline = row => row ? {
    ...investorPipelineRow(row, { mode }),
    ...(typeof row.notes === "string" ? { notes: row.notes } : {}),
  } : null;
  const card = row => ({
    ...pick(row, ["id", "name", "logo", "founders", "description", "industry", "country",
      "raise_amount", "currency", "deal_flow_id", ...(mode === "full_pipeline" ? ["stage"] : [])]),
    founders_countries: Array.isArray(row.founders_countries)
      ? row.founders_countries.filter(country => typeof country === "string") : [],
    ...(row.deck && typeof row.deck === "object"
      ? { deck: pick(row.deck, ["id", "version"]) } : {}),
  });
  if (surface === "dashboard") {
    result.features = Object.fromEntries([
      "dashboardV2",
      "introductions",
      "messaging",
      "meetings",
      "investmentConfirmation",
      "nda",
      "onboarding",
    ].map(key => [key, payload.features?.[key] === true]));
    if (Object.hasOwn(payload, "weeklyActivity")) result.weeklyActivity = payload.weeklyActivity === null
      ? null : many(payload.weeklyActivity, row => pick(row, ["week", "views", "interests", "introductions"]));
    if (Object.hasOwn(payload, "charts") && payload.charts) {
      result.charts = {
        pipelineByStage: many(payload.charts.pipelineByStage, row => pick(row, ["stage", "count"])),
        venturesByIndustry: many(payload.charts.venturesByIndustry, row => pick(row, ["industry", "count"])),
      };
    }
    if (typeof payload.activeNdaVersion === "string" || payload.activeNdaVersion === null) {
      result.activeNdaVersion = payload.activeNdaVersion;
    }
    result.profile = toInvestorSelfProfile(payload.profile);
    result.pipeline = many(payload.pipeline, pipeline);
    result.watchlist = many(payload.watchlist, row => investorWatchlistRow(row, { mode }));
    result.recommendations = many(payload.recommendations, card);
    result.campaigns = many(payload.campaigns, investorCampaign);
    result.relationships = many(payload.relationships, investorRelationship);
    result.stats = pick(payload.stats, [
      "total_pipeline",
      "invested_count",
      "pending_investment_count",
      "active_evaluations",
      "watchlist_count",
    ]);
  } else if (surface === "ventures" || surface === "dealFlow") {
    const key = surface === "ventures" ? "ventures" : "entries";
    result[key] = many(payload[key], row => {
      const item = card(row);
      if (surface === "dealFlow" && row.deck) item.deck = pick(row.deck, ["id", "version"]);
      return item;
    });
    if (surface === "ventures") Object.assign(result, pick(payload, ["total", "page", "totalPages"]));
  } else if (surface === "pipeline") {
    result.pipeline = Array.isArray(payload.pipeline) ? payload.pipeline.map(pipeline) : pipeline(payload.pipeline);
  } else if (surface === "campaigns") {
    result.campaigns = many(payload.campaigns, investorCampaign);
  } else if (surface === "relationships") {
    result.relationships = many(payload.relationships, investorRelationship);
    if (payload.workspace) result.workspace = investorRelationship(payload.workspace);
    // Internal relationship timelines and staff assignments are never copied.
  } else if (surface === "diligence") {
    for (const [key, type] of [["workspace", "workspace"], ["request", "request"], ["note", "note"]]) {
      if (Object.hasOwn(payload, key)) result[key] = pick(payload[key], FIELDS[type]);
    }
    if (Object.hasOwn(payload, "pipeline")) result.pipeline = pipeline(payload.pipeline);
    for (const [key, type] of [["requests", "request"], ["notes", "note"]]) {
      if (Object.hasOwn(payload, key)) result[key] = many(payload[key], row => pick(row, FIELDS[type]));
    }
  } else if (surface === "documents") {
    if (Object.hasOwn(payload, "document")) result.document = pick(payload.document, FIELDS.document);
    if (Object.hasOwn(payload, "documents")) result.documents = many(payload.documents, row => pick(row, FIELDS.document));
  } else if (surface === "meetings") {
    if (Object.hasOwn(payload, "meeting")) result.meeting = pick(payload.meeting, FIELDS.meeting);
    if (Object.hasOwn(payload, "meetings")) result.meetings = many(payload.meetings, row => pick(row, FIELDS.meeting));
  } else if (surface === "decisions") {
    result.decisions = many(payload.decisions, row => pick(row, FIELDS.decision));
    // No studio timeline, narrative or unchecked aggregate is forwarded.
    result.history = [];
    result.stats = pick(payload.stats, ["total_invested", "total_capital", "total_declined", "total_decisions"]);
  } else if (surface === "kpis") {
    result.kpis = [];
  } else if (surface === "updates") {
    result.updates = [];
  } else if (surface === "evaluation") {
    // Evaluations are internal studio information, not investor-visible cards.
    result.evaluations = [];
    result.risks = [];
  }
  return result;
}

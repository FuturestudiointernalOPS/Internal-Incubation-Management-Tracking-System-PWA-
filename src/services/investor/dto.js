/**
 * Investor-facing view models (Phase 1 DTO gate).
 *
 * Whitelist only: the hidden venture metrics (customers, customer growth,
 * retention, revenue, burn, runway, north-star, traffic light, completion
 * index, narrative) NEVER reach an investor session — whatever the endpoint.
 */

export function investorVentureCard(venture, { mode = "deal_flow_only", dealFlow = null } = {}) {
  const card = {
    id: venture.venture_internal_id ?? venture.venture_id ?? venture.id ?? null,
    name: venture.name ?? venture.company_name ?? null,
    logo: venture.logo_url ?? venture.logo ?? null,
    founders: venture.founders_count ?? venture.founder_count ?? null,
    founders_countries: Array.isArray(venture.founders_countries)
      ? venture.founders_countries.filter(country => typeof country === "string") : [],
    description: venture.description ?? null,
    industry: venture.industry ?? null,
    country: venture.country ?? null,
  };

  // The stage field is exposed only in Full pipeline mode.
  if (mode === "full_pipeline") card.stage = venture.business_stage ?? null;

  if (venture.deck_id != null) {
    card.deck = { id: venture.deck_id, version: venture.deck_version ?? null };
  }

  // A deal-flow card additionally shows the raise amount.
  if (dealFlow || venture.raise_amount != null) {
    card.raise_amount = dealFlow?.target_amount ?? venture.raise_amount ?? null;
    card.currency = dealFlow?.currency ?? venture.currency ?? null;
    if (venture.deal_flow_id != null) card.deal_flow_id = venture.deal_flow_id;
  }

  return card;
}

export function investorVentureList(ventures, ctx = {}) {
  return (ventures || []).map((venture) => investorVentureCard(venture, ctx));
}

/** Pipeline rows: the investor's own stage tracking only. */
export function investorPipelineRow(row, { mode = "deal_flow_only" } = {}) {
  return {
    id: row.id,
    venture_id: row.venture_id,
    venture_name: row.venture_name ?? null,
    ...(typeof row.industry === "string" && row.industry ? { industry: row.industry } : {}),
    stage: row.stage ?? null,
    stage_changed_at: row.stage_changed_at ?? null,
    ...(row.investment_id != null ? { investment_id: row.investment_id } : {}),
    ...(row.confirmation_status != null
      ? { confirmation_status: row.confirmation_status } : {}),
    ...(row.investment_amount != null ? { investment_amount: row.investment_amount } : {}),
    ...(row.investment_currency != null ? { investment_currency: row.investment_currency } : {}),
    ...(row.investment_instrument != null
      ? { investment_instrument: row.investment_instrument } : {}),
    ...(row.investment_date != null ? { investment_date: row.investment_date } : {}),
    ...(row.investment_reject_reason != null
      ? { investment_reject_reason: row.investment_reject_reason } : {}),
    ...(row.workspace_id != null ? { workspace_id: row.workspace_id } : {}),
    ...(mode === "full_pipeline" ? { venture_status: row.venture_status ?? null } : {}),
  };
}

/** Watchlist rows: no hidden venture metrics, campaign trimmed to public facts. */
export function investorWatchlistRow(row, { mode = "deal_flow_only" } = {}) {
  const item = {
    id: row.id,
    ...(row.venture_id != null ? { venture_id: row.venture_id } : {}),
    venture_name: row.venture_name ?? null,
    industry: row.industry ?? null,
    country: row.country ?? null,
    description: row.description ?? null,
    founders: row.founders_count ?? row.founder_count ?? null,
    founders_countries: Array.isArray(row.founders_countries)
      ? row.founders_countries.filter(country => typeof country === "string") : [],
    ...(row.deal_flow_id != null ? { deal_flow_id: row.deal_flow_id } : {}),
    ...(row.deck_id != null ? { deck: { id: row.deck_id, version: row.deck_version ?? null } } : {}),
  };

  if (mode === "full_pipeline") item.stage = row.business_stage ?? null;

  if (row.campaign_id) {
    item.campaign = {
      id: row.campaign_id,
      name: row.campaign_name ?? null,
      status: row.campaign_status ?? null,
      target_raise: row.target_raise ?? null,
    };
  }

  return item;
}

/** Campaign cards expose the raise target, not internal progress or interest. */
export function investorCampaign(row) {
  return Object.fromEntries(["id", "venture_id", "venture_name", "name", "industry",
    "country", "target_raise", "currency", "closing_date"]
    .filter(key => Object.hasOwn(row, key))
    .map(key => [key, row[key]]));
}

/** Own relationship facts only; keep notes/assignees/internal timeline private. */
export function investorRelationship(row) {
  const item = Object.fromEntries(["id", "venture_id", "venture_name", "pipeline_id", "status"]
    .filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]));
  item.next_meetings = (row.next_meetings || []).map(meeting => Object.fromEntries(
    ["id", "meeting_type", "scheduled_date", "scheduled_time", "start_at", "timezone", "video_link", "status", "location"]
      .filter(key => Object.hasOwn(meeting, key)).map(key => [key, meeting[key]]),
  ));
  return item;
}

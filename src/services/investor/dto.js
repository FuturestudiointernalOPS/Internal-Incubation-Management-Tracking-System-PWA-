/**
 * Investor-facing view models (Phase 1 DTO gate).
 *
 * Whitelist only: the hidden venture metrics (customers, customer growth,
 * retention, revenue, burn, runway, north-star, traffic light, completion
 * index, narrative) NEVER reach an investor session — whatever the endpoint.
 */

export function investorVentureCard(venture, { mode = "deal_flow_only", dealFlow = null } = {}) {
  const card = {
    id: venture.venture_id ?? venture.id ?? null,
    name: venture.name ?? venture.company_name ?? null,
    logo: venture.logo_url ?? venture.logo ?? null,
    founders: venture.founders_count ?? venture.founder_count ?? null,
    description: venture.description ?? null,
    industry: venture.industry ?? null,
    country: venture.country ?? null,
  };

  // The stage field is exposed only in Full pipeline mode.
  if (mode === "full_pipeline") card.stage = venture.business_stage ?? null;

  // A deal-flow card additionally shows the raise amount.
  if (dealFlow) {
    card.raise_amount = dealFlow.target_amount ?? null;
    card.currency = dealFlow.currency ?? null;
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
    stage: row.stage ?? null,
    stage_changed_at: row.stage_changed_at ?? null,
    ...(mode === "full_pipeline" ? { venture_status: row.venture_status ?? null } : {}),
  };
}

/** Watchlist rows: no hidden venture metrics, campaign trimmed to public facts. */
export function investorWatchlistRow(row, { mode = "deal_flow_only" } = {}) {
  const item = {
    id: row.id,
    venture_id: row.venture_id,
    venture_name: row.venture_name ?? null,
    industry: row.industry ?? null,
    country: row.country ?? null,
    description: row.description ?? null,
  };

  if (mode === "full_pipeline") item.stage = row.business_stage ?? null;

  if (row.campaign_id) {
    item.campaign = {
      id: row.campaign_id,
      name: row.campaign_name ?? null,
      status: row.campaign_status ?? null,
      target_raise: row.target_raise ?? null,
      current_raised: row.current_raised ?? null,
      min_investment: row.min_investment ?? null,
    };
  }

  return item;
}

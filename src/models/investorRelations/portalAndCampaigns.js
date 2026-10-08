import db from "@/lib/db";

// ── GET/POST /api/investor/decisions ─────────────────────────────────────────

/** Profile id resolver for the decisions list branch. */
export async function getInvestorProfileIdForDecisions(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** All investment decisions for one investor with venture info. */
export async function listInvestorDecisions(investorProfileId) {
  return db.execute({
    sql: `SELECT d.*, ip.venture_id, p.name as venture_name, p.industry,
                   ip.stage as pipeline_stage, ip.created_at as pipeline_created
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY d.decision_date DESC`,
    args: [investorProfileId],
  });
}

/** Investment history timeline (all pipeline activity) for one investor. */
export async function listInvestorHistoryTimeline(investorProfileId) {
  return db.execute({
    sql: `SELECT ip.id, ip.venture_id, p.name as venture_name, ip.stage,
                   ip.stage_changed_at, ip.notes, ip.created_at,
                   d.decision_type, d.investment_amount, d.decision_date
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC NULLS LAST`,
    args: [investorProfileId],
  });
}

/** Decision stats (invested/declined/total) for one investor. */
export async function getInvestorDecisionStats(investorProfileId) {
  return db.execute({
    sql: `SELECT
              COUNT(*) FILTER (WHERE d.decision_type = 'invest') as total_invested,
              COALESCE(SUM(d.investment_amount) FILTER (WHERE d.decision_type = 'invest'), 0) as total_capital,
              COUNT(*) FILTER (WHERE d.decision_type = 'decline') as total_declined,
              COUNT(*) as total_decisions
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?`,
    args: [investorProfileId],
  });
}

/** Record (or update) an investment decision for a pipeline. */
export async function recordInvestmentDecision(pipelineId, decisionType, investmentAmount, decisionNotes) {
  return db.execute({
    sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, investment_amount, decision_notes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (pipeline_id) DO UPDATE
            SET decision_type = EXCLUDED.decision_type, investment_amount = EXCLUDED.investment_amount,
                decision_notes = EXCLUDED.decision_notes, decision_date = CURRENT_DATE`,
    args: [pipelineId, decisionType, investmentAmount, decisionNotes],
  });
}

/** Move the pipeline stage to match a recorded decision. */
export async function updatePipelineStageAfterDecision(stage, pipelineId) {
  return db.execute({
    sql: "UPDATE investment_pipeline SET stage = ?, stage_changed_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [stage, pipelineId],
  });
}

// ── GET/POST /api/investor/approval ──────────────────────────────────────────

/** Investors with contact info, filterable by approval status + search. */
export async function listInvestorsByApprovalStatus({ status, search }) {
  let sql = `SELECT ip.*, c.name, c.email, c.status as contact_status, c.created_at as joined_at
               FROM investor_profiles ip
               JOIN contacts c ON ip.user_id = c.cid
               WHERE 1=1`;
  const args = [];

  if (status !== "all") {
    sql += " AND ip.approval_status = ?";
    args.push(status);
  }
  if (search) {
    sql += " AND (c.name ILIKE ? OR c.email ILIKE ? OR ip.organization_name ILIKE ?)";
    const searchPattern = `%${search}%`;
    args.push(searchPattern, searchPattern, searchPattern);
  }

  sql += " ORDER BY ip.created_at DESC";

  return db.execute({ sql, args });
}

/** Set an investor profile's approval status. */
export async function setInvestorApprovalStatus(profileId, newStatus) {
  return db.execute({
    sql: "UPDATE investor_profiles SET approval_status = ?, updated_at = NOW() WHERE id = ?",
    args: [newStatus, profileId],
  });
}

/** Persist review notes on an investor profile. */
export async function setInvestorReviewNotes(profileId, reason) {
  return db.execute({
    sql: "UPDATE investor_profiles SET review_notes = ?, reviewed_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [reason, profileId],
  });
}

/** Investor profile + contact info for the approval notification. */
export async function getInvestorWithContactByProfileId(profileId) {
  return db.execute({
    sql: `SELECT ip.*, c.name, c.email FROM investor_profiles ip
            JOIN contacts c ON ip.user_id = c.cid WHERE ip.id = ?`,
    args: [profileId],
  });
}

/** Notify the investor that their account status changed. */
export async function notifyInvestorOfApprovalStatus(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'investor', 0, NOW())`,
    args: [recipientId, title, message],
  });
}

// ── POST /api/investor/watchlist ─────────────────────────────────────────────

/** Profile id resolver for the watchlist toggle. */
export async function getInvestorProfileIdForWatchlist(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Existing watchlist entry for an investor + venture pair. */
export async function findWatchlistEntry(investorId, ventureId) {
  return db.execute({
    sql: "SELECT id FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
    args: [investorId, ventureId],
  });
}

/** Remove a venture from the investor's watchlist. */
export async function removeWatchlistEntry(investorId, ventureId) {
  return db.execute({
    sql: "DELETE FROM investor_watchlist WHERE investor_id = ? AND venture_id = ?",
    args: [investorId, ventureId],
  });
}

/** Add a venture to the investor's watchlist. */
export async function addWatchlistEntry(investorId, ventureId, personalNotes) {
  return db.execute({
    sql: "INSERT INTO investor_watchlist (investor_id, venture_id, personal_notes) VALUES (?, ?, ?)",
    args: [investorId, ventureId, personalNotes],
  });
}

// ── POST /api/investor/preferences ───────────────────────────────────────────

/** Profile id resolver for the preferences upsert. */
export async function getInvestorProfileIdForPreferences(userId) {
  return db.execute({
    sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
    args: [userId],
  });
}

/** Upsert investor preferences (philosophy variant, self-service). */
export async function upsertInvestorPreferencesWithPhilosophy(investorId, industries, countries, startupStages, ticketSizeMin, ticketSizeMax, investmentPhilosophy) {
  return db.execute({
    sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max, investment_philosophy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (investor_id)
            DO UPDATE SET industries = EXCLUDED.industries, countries = EXCLUDED.countries,
                          startup_stages = EXCLUDED.startup_stages, ticket_size_min = EXCLUDED.ticket_size_min,
                          ticket_size_max = EXCLUDED.ticket_size_max, investment_philosophy = EXCLUDED.investment_philosophy,
                          updated_at = NOW()`,
    args: [investorId, industries, countries, startupStages, ticketSizeMin, ticketSizeMax, investmentPhilosophy],
  });
}

// ── POST /api/investor/setup-password ────────────────────────────────────────

/** Contact lookup by a valid setup token. */
export async function findContactBySetupToken(token) {
  return db.execute({
    sql: `SELECT cid, setup_token_expires FROM contacts
            WHERE setup_token = ? AND deleted_at IS NULL`,
    args: [token],
  });
}

/** Set a contact's password and clear the setup token. */
export async function clearSetupTokenAndSetPassword(hashedPassword, contactCid) {
  return db.execute({
    sql: `UPDATE contacts SET password = ?, setup_token = NULL, setup_token_expires = NULL WHERE cid = ?`,
    args: [hashedPassword, contactCid],
  });
}

// ── GET/POST/PUT /api/investor/campaigns ─────────────────────────────────────

/** Fundraising campaigns with venture info + investor counts, filterable. */
export async function listFundraisingCampaigns({ ventureId, status, investorId = null }) {
  let sql = `SELECT fc.*, p.name as venture_name, p.industry, p.country, p.business_stage,
                      p.funding_requirement, p.completion_index,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage NOT IN ('declined')) as investor_count,
                      (SELECT COUNT(*) FROM investment_pipeline WHERE venture_id = fc.venture_id AND stage IN ('due_diligence','negotiation')) as active_dd_count
               FROM fundraising_campaigns fc
               LEFT JOIN v2_programs p ON fc.venture_id = p.id
               WHERE 1=1`;
  const args = [];

  if (ventureId) {
    sql += " AND fc.venture_id = ?";
    args.push(ventureId);
  }
  if (status) {
    sql += " AND fc.status = ?";
    args.push(status);
  }
  // Phase 1.5: non-management sessions (investor/member context) only see
  // campaigns for ventures they are engaged with in the pipeline.
  if (investorId) {
    sql +=
      " AND fc.venture_id IN (SELECT DISTINCT venture_id FROM investment_pipeline WHERE investor_id = ?)";
    args.push(investorId);
  }

  sql += " ORDER BY fc.created_at DESC";

  return db.execute({ sql, args });
}

/** Create a draft fundraising campaign. */
export async function insertFundraisingCampaign(ventureId, name, targetRaise, minInvestment, maxInvestment, currency, visibility, openingDate, closingDate) {
  return db.execute({
    sql: `INSERT INTO fundraising_campaigns (venture_id, name, target_raise, min_investment, max_investment, currency, visibility, opening_date, closing_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
            RETURNING *`,
    args: [ventureId, name, targetRaise, minInvestment, maxInvestment, currency, visibility, openingDate, closingDate],
  });
}

/** Pre-update funding snapshot for milestone detection. */
export async function getCampaignFundingSnapshot(campaignId) {
  return db.execute({
    sql: "SELECT current_raised, target_raise, venture_id FROM fundraising_campaigns WHERE id = ?",
    args: [campaignId],
  });
}

/** Partial update of a fundraising campaign. */
export async function updateFundraisingCampaign(campaignId, updates) {
  const sets = [];
  const args = [];

  if (updates.status) { sets.push("status = ?"); args.push(updates.status); }
  if (updates.current_raised !== undefined) { sets.push("current_raised = ?"); args.push(parseFloat(updates.current_raised)); }
  if (updates.target_raise !== undefined) { sets.push("target_raise = ?"); args.push(parseFloat(updates.target_raise)); }
  if (updates.min_investment !== undefined) { sets.push("min_investment = ?"); args.push(parseFloat(updates.min_investment)); }
  if (updates.max_investment !== undefined) { sets.push("max_investment = ?"); args.push(parseFloat(updates.max_investment)); }
  if (updates.name) { sets.push("name = ?"); args.push(updates.name); }
  if (updates.visibility) { sets.push("visibility = ?"); args.push(updates.visibility); }

  if (sets.length === 0) return { updated: false };

  sets.push("updated_at = NOW()");
  args.push(campaignId);

  return db.execute({
    sql: `UPDATE fundraising_campaigns SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args,
  });
}

/** Venture profile used for campaign-launch investor matching. */
export async function getCampaignVentureProfile(ventureId) {
  return db.execute({
    sql: "SELECT name, industry, country, business_stage FROM v2_programs WHERE id = ?",
    args: [ventureId],
  });
}

/** Approved investors with their preference lists. */
export async function listApprovedInvestorsWithPreferences() {
  return db.execute({
    sql: `SELECT DISTINCT ip.user_id, ip.id as profile_id, ipr.industries, ipr.countries, ipr.startup_stages
                FROM investor_profiles ip
                LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
                WHERE ip.approval_status = 'approved'`,
    args: [],
  });
}

/** Notify an investor about a newly opened campaign. */
export async function notifyInvestorOfNewCampaign(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [recipientId, title, message, "/investor/dashboard?tab=discover"],
  });
}

/** Venture name for a funding-milestone alert. */
export async function getVentureNameForMilestoneAlert(programId) {
  return db.execute({
    sql: "SELECT name FROM v2_programs WHERE id = ?",
    args: [programId],
  });
}

/** Approved investors watching a venture. */
export async function listInvestorsWatchingVenture(ventureId) {
  return db.execute({
    sql: `SELECT DISTINCT ip.user_id FROM investor_watchlist iw
                  JOIN investor_profiles ip ON iw.investor_id = ip.id
                  WHERE iw.venture_id = ? AND ip.approval_status = 'approved'`,
    args: [ventureId],
  });
}

/** Notify a watching investor that a funding milestone was hit. */
export async function notifyInvestorOfFundingMilestone(recipientId, title, message) {
  return db.execute({
    sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                    VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
    args: [recipientId, title, message, "/investor/dashboard?tab=watchlist"],
  });
}

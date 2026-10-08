import db from "@/lib/db";

/**
 * Communications — campaign reads and writes (REPOSITORY layer).
 *
 * Retired domain (see the campaigns routes): the SQL is kept for a future
 * re-enable. Split verbatim out of `models/communications.js` — see
 * docs/LAYER_SPLIT.md.
 */

/** Campaign list with contact + step counts (dead while RETIRED). */
export async function listCampaignsWithStats() {
  return db.execute(`
    SELECT c.*,
           COUNT(cc.id) as total_contacts,
           SUM(CASE WHEN cc.status != 'pending' THEN 1 ELSE 0 END) as sent_contacts,
           (SELECT COUNT(*) FROM campaign_steps cs WHERE cs.campaign_id = c.id) as total_steps
    FROM campaigns c
    LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
}

/** Insert a pending campaign and return its id. */
export async function insertCampaign(name, formId) {
  return db.execute({
    sql: "INSERT INTO campaigns (name, form_id, status) VALUES (?, ?, 'pending') RETURNING id",
    args: [name, formId || null],
  });
}

/** Single campaign with contact counts by id. */
export async function getCampaignWithCounts(id) {
  return db.execute({
    sql: `SELECT c.*,
                   COUNT(cc.id) as total_contacts,
                   SUM(CASE WHEN cc.status != 'pending' THEN 1 ELSE 0 END) as sent_contacts
            FROM campaigns c
            LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
            WHERE c.id = ?
            GROUP BY c.id`,
    args: [id],
  });
}

/** Campaign steps ordered by step_order. */
export async function getCampaignSteps(id) {
  return db.execute({
    sql: "SELECT * FROM campaign_steps WHERE campaign_id = ? ORDER BY step_order",
    args: [id],
  });
}

/** Campaign contacts (contact_cid + status). */
export async function getCampaignContacts(id) {
  return db.execute({
    sql: "SELECT contact_cid, status FROM campaign_contacts WHERE campaign_id = ?",
    args: [id],
  });
}

/** Update a campaign's name/form_id. */
export async function updateCampaign({ id, name, formId }) {
  return db.execute({
    sql: "UPDATE campaigns SET name = ?, form_id = ? WHERE id = ?",
    args: [name, formId || null, id],
  });
}

/** Delete every step of a campaign (before re-inserting the new sequence). */
export async function deleteCampaignSteps(campaignId) {
  return db.execute({
    sql: "DELETE FROM campaign_steps WHERE campaign_id = ?",
    args: [campaignId],
  });
}

/** Existing contact_cids of a campaign (sync target-audience diffing). */
export async function getCampaignContactCids(campaignId) {
  return db.execute({
    sql: "SELECT contact_cid FROM campaign_contacts WHERE campaign_id = ?",
    args: [campaignId],
  });
}

/** Remove campaign contacts that were dropped from the target audience. */
export async function deleteCampaignContacts(campaignId, contactCids) {
  return db.execute({
    sql: `DELETE FROM campaign_contacts WHERE campaign_id = ? AND contact_cid IN (${contactCids.map(() => "?").join(",")}) AND status != 'sent'`,
    args: [campaignId, ...contactCids],
  });
}

/** Insert a campaign's step sequence, in order, in one wave (POST/PUT). */
export async function insertCampaignSteps(campaignId, steps) {
  const queries = steps.map((step, stepOrder) => ({
    sql: "INSERT INTO campaign_steps (campaign_id, step_order, subject, body, delay_hours) VALUES (?, ?, ?, ?, ?)",
    args: [campaignId, stepOrder, step.subject, step.body, step.delayHours],
  }));
  return db.batch(queries);
}

/** Insert campaigns contacts as 'pending', in one wave (POST/PUT). */
export async function insertCampaignContacts(campaignId, contactCids) {
  const queries = contactCids.map((contactCid) => ({
    sql: "INSERT INTO campaign_contacts (campaign_id, contact_cid, status) VALUES (?, ?, 'pending')",
    args: [campaignId, contactCid],
  }));
  return db.batch(queries);
}

/** Delete a campaign together with its steps and contacts, in one wave. */
export async function deleteCampaignCascade(campaignId) {
  return db.batch([
    { sql: "DELETE FROM campaigns WHERE id = ?", args: [campaignId] },
    { sql: "DELETE FROM campaign_steps WHERE campaign_id = ?", args: [campaignId] },
    { sql: "DELETE FROM campaign_contacts WHERE campaign_id = ?", args: [campaignId] },
  ]);
}

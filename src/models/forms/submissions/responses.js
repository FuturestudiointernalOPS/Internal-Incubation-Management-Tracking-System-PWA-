import db from "@/lib/db";

/**
 * Forms & submissions model — campaign responses (REPOSITORY layer).
 *
 * The form-response/campaign reads and the manual response-match writes behind
 * `src/app/api/responses/route.js` and `src/app/api/responses/review/route.js`.
 * Split verbatim out of `models/forms/submissions.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Per-campaign response tallies (yes/no/responded/sent/pending counts). */
export async function getCampaignResponseStats() {
  return db.execute(`
    SELECT
      c.id, c.name,
      COUNT(cc.id) as total,
      SUM(CASE WHEN cc.status = 'yes' THEN 1 ELSE 0 END) as yes_count,
      SUM(CASE WHEN cc.status = 'no' THEN 1 ELSE 0 END) as no_count,
      SUM(CASE WHEN cc.status = 'responded' THEN 1 ELSE 0 END) as other_responses,
      SUM(CASE WHEN cc.status = 'sent' THEN 1 ELSE 0 END) as pending_response,
      SUM(CASE WHEN cc.status = 'pending' THEN 1 ELSE 0 END) as unsent
    FROM campaigns c
    LEFT JOIN campaign_contacts cc ON c.id = cc.campaign_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
}

/** All form responses joined with contact + form names, newest first. */
export async function listFormResponses() {
  return db.execute(`
      SELECT fr.*, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      ORDER BY fr.created_at DESC
    `);
}

/** Contact + campaign_contact status rows (detailed contacts list). */
export async function listCampaignContactsWithNames() {
  return db.execute(`
    SELECT cc.campaign_id, cc.contact_cid, cc.status, c.name, c.email
    FROM campaign_contacts cc
    JOIN contacts c ON cc.contact_cid = c.cid
  `);
}

/** Form responses flagged for manual matching, newest first. */
export async function listFlaggedFormResponses() {
  return db.execute(`
      SELECT fr.id as response_id, fr.answers, fr.confidence_score, fr.created_at, fr.cid, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      WHERE fr.match_status = 'flagged'
      ORDER BY fr.created_at DESC
    `);
}

/** Attach a contact to a form response and clear its flagged status. */
export async function resolveFormResponseMatch({ responseId, cid }) {
  return db.execute({
    sql: "UPDATE form_responses SET cid = ?, match_status = 'resolved' WHERE id = ?",
    args: [cid, responseId],
  });
}

/** Answers + form id of a single form response. */
export async function getFormResponseById(responseId) {
  return db.execute({
    sql: "SELECT answers, form_id FROM form_responses WHERE id = ?",
    args: [responseId],
  });
}

/** Sync campaign_contact status after a manual response match. */
export async function updateCampaignContactMatchStatus({ status, cid, formId }) {
  return db.execute({
    sql: "UPDATE campaign_contacts SET status = ? WHERE contact_cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)",
    args: [status, cid, formId],
  });
}

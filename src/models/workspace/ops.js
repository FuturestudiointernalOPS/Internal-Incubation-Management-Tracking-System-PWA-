import db from "@/lib/db";

/**
 * Workspace model — activity log, run export and pending campaign dispatch
 * (REPOSITORY layer).
 *
 * Split verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** 100 most recent activity log rows. */
export async function listActivityLogs() {
  return db.execute(
    `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100`,
  );
}

/** Append one activity log row. */
export async function createActivityLog(userIdentity, action) {
  return db.execute({
    sql: "INSERT INTO activity_logs (user_identity, action) VALUES (?, ?)",
    args: [userIdentity, action],
  });
}

/** Run row joined with its form name (export header data). */
export async function getRunWithFormName(runId) {
  return db.execute({
    sql: `SELECT r.id, r.name, r.status, f.name AS form_name
            FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id
            WHERE r.id = ?`,
    args: [runId],
  });
}

/** Submissions of a run, newest first (export body data). */
export async function getRunSubmissions(runId) {
  return db.execute({
    sql: "SELECT id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE run_id = ? ORDER BY submitted_at DESC NULLS LAST",
    args: [runId],
  });
}

/** Up to 10 pending campaign contacts with their first-step content. */
export async function getPendingCampaignContacts() {
  return db.execute(`
      SELECT cc.id as cc_id, cc.contact_cid, cc.campaign_id,
             c.email, c.name, cam.name as campaign_name, cam.form_id,
             cs.subject as step_subject, cs.body as step_body
      FROM campaign_contacts cc
      JOIN contacts c ON cc.contact_cid = c.cid
      JOIN campaigns cam ON cc.campaign_id = cam.id
      JOIN campaign_steps cs ON cc.campaign_id = cs.campaign_id AND cs.step_order = 0
      WHERE cc.status = 'pending'
      AND cam.status != 'paused'
      LIMIT 10
    `);
}

/** Mark a campaign contact as completed after its email was sent. */
export async function completeCampaignContact(campaignContactId) {
  return db.execute({
    sql: `UPDATE campaign_contacts SET status = 'completed', sent_at = NOW() WHERE id = ?`,
    args: [campaignContactId],
  });
}

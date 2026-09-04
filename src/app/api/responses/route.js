import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

// ── RESPONSES RETIRED ──────────────────────────────────────────────────────
// Responses are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Responses are retired and no longer accessible." },
  { status: 403 },
);

export const GET = createHandler({ roles: ["staff", "super_admin"] }, async () => {
  if (RETIRED) return RETIRED_RESPONSE;
  const campaignsResult = await db.execute(`
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

  let responsesResult;
  try {
    responsesResult = await db.execute(`
      SELECT fr.*, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      ORDER BY fr.created_at DESC
    `);
  } catch (e) {
    // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    responsesResult = { rows: [] };
  }

  const campaignContactsResult = await db.execute(`
    SELECT cc.campaign_id, cc.contact_cid, cc.status, c.name, c.email
    FROM campaign_contacts cc
    JOIN contacts c ON cc.contact_cid = c.cid
  `);

  let flaggedResult;
  try {
    flaggedResult = await db.execute(`
      SELECT fr.id as response_id, fr.answers, fr.confidence_score, fr.created_at, fr.cid, c.email, c.name, f.name as form_name
      FROM form_responses fr
      LEFT JOIN contacts c ON fr.cid = c.cid
      LEFT JOIN forms f ON fr.form_id = f.form_id
      WHERE fr.match_status = 'flagged'
      ORDER BY fr.created_at DESC
    `);
  } catch (e) {
    // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    flaggedResult = { rows: [] };
  }

  const responsesParsed = responsesResult.rows.map((r) => ({
    ...r,
    answers: JSON.parse(r.answers),
  }));
  const flaggedParsed = flaggedResult.rows.map((r) => ({
    ...r,
    answers: JSON.parse(r.answers),
  }));

  return NextResponse.json({
    success: true,
    campaignStats: campaignsResult.rows,
    detailedResponses: responsesParsed,
    contactsDetailed: campaignContactsResult.rows,
    flaggedResponses: flaggedParsed,
  });
});

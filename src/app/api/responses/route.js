import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getCampaignResponseStats,
  listFormResponses,
  listCampaignContactsWithNames,
  listFlaggedFormResponses,
} from "@/models/forms";

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
  const campaignsResult = await getCampaignResponseStats();

  let responsesResult;
  try {
    responsesResult = await listFormResponses();
  } catch (e) {
    // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    responsesResult = { rows: [] };
  }

  const campaignContactsResult = await listCampaignContactsWithNames();

  let flaggedResult;
  try {
    flaggedResult = await listFlaggedFormResponses();
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

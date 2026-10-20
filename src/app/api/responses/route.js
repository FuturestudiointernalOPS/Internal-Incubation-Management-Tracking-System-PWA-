import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { retiredRouteResponse } from "@/server/http/refusal";
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

export const GET = createHandler(async () => {
  if (RETIRED) return retiredRouteResponse("responses");
  const campaignsResult = await getCampaignResponseStats();

  let responsesResult;
  try {
    responsesResult = await listFormResponses();
  } catch {
    // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    responsesResult = { rows: [] };
  }

  const campaignContactsResult = await listCampaignContactsWithNames();

  let flaggedResult;
  try {
    flaggedResult = await listFlaggedFormResponses();
  } catch {
    // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    flaggedResult = { rows: [] };
  }

  const responsesParsed = responsesResult.rows.map((row) => ({
    ...row,
    answers: JSON.parse(row.answers),
  }));
  const flaggedParsed = flaggedResult.rows.map((row) => ({
    ...row,
    answers: JSON.parse(row.answers),
  }));

  return NextResponse.json({
    success: true,
    campaignStats: campaignsResult.rows,
    detailedResponses: responsesParsed,
    contactsDetailed: campaignContactsResult.rows,
    flaggedResponses: flaggedParsed,
  });
});

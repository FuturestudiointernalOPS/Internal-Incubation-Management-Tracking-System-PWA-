import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  resolveFormResponseMatch,
  getFormResponseById,
  updateCampaignContactMatchStatus,
} from "@/models/forms";

// ── RESPONSES RETIRED ──────────────────────────────────────────────────────
// Responses are hidden from the sidebar and their API is disabled (403).
// The code below is intentionally kept — set RETIRED = false to re-enable.
const RETIRED = true;
const RETIRED_RESPONSE = NextResponse.json(
  { success: false, error: "Responses are retired and no longer accessible." },
  { status: 403 },
);

export const POST = createHandler(
  { roles: ["super_admin", "staff", "teacher"] },
  async (req) => {
    if (RETIRED) return RETIRED_RESPONSE;
    const { response_id, cid } = await req.json();
    if (!response_id || !cid)
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 },
      );

    try {
      await resolveFormResponseMatch({ responseId: response_id, cid });
    } catch (e) {
      // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
    }

    let responseData;
    try {
      responseData = await getFormResponseById(response_id);
    } catch (e) {
      // form_responses schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 13
      responseData = { rows: [] };
    }
    if (responseData.rows.length > 0) {
      const form_id = responseData.rows[0].form_id;
      const answers = JSON.parse(responseData.rows[0].answers || "{}");
      const hasYes = Object.values(answers).some(
        (v) => v === "Yes" || String(v).toLowerCase() === "yes" || v === true,
      );
      const hasNo = Object.values(answers).some(
        (v) => v === "No" || String(v).toLowerCase() === "no" || v === false,
      );
      let status = "responded";
      if (hasYes) status = "yes";
      else if (hasNo) status = "no";
      await updateCampaignContactMatchStatus({ status, cid, formId: form_id });
    }

    return NextResponse.json({
      success: true,
      message: "Manually matched successfully.",
    });
  },
);

import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getReportingSettings,
  updateReportingSetting,
} from "@/services/ventures/reporting/settings";

/**
 * GET /api/ventures/[id]/reporting/settings
 *   Thresholds (override applied), bands and glossary — readable by anyone who
 *   can see the venture.
 *
 * PUT — STUDIO ONLY. Settings are global, so this route is role-gated rather
 *   than venture-scoped. A write creates a new effective-dated row.
 */

export const GET = createHandler(async (req) => {
  const { searchParams } = new URL(req.url);
  const businessModel = searchParams.get("businessModel") || "default";
  return NextResponse.json({ success: true, ...(await getReportingSettings({ businessModel })) });
});

export const PUT = createHandler({ roles: ["super_admin", "staff"] }, async (req) => {
  const body = await req.json().catch(() => ({}));
  const result = await updateReportingSetting({
    settingKey: body.settingKey,
    businessModel: body.businessModel,
    value: body.value,
    valueType: body.valueType,
    actorCid: req.session?.cid || null,
  });
  if (result.error) {
    return NextResponse.json({ success: false, errors: [result.error] }, { status: 400 });
  }
  return NextResponse.json({ success: true });
});

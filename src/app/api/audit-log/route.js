import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { listAuditLogs } from "@/models/adminOps";

export const GET = createHandler(async (req) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const entity_type = searchParams.get("entity_type");
  const entity_id = searchParams.get("entity_id");
  const user_id = searchParams.get("user_id");
  const action = searchParams.get("action");
  const limit = searchParams.get("limit");

  const result = await listAuditLogs({ entity_type, entity_id, user_id, action, limit });
  return NextResponse.json({ success: true, entries: result.rows });
});

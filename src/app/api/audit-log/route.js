import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listAuditLogs } from "@/models/adminOps";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const entity_type = searchParams.get("entity_type");
  const entity_id = searchParams.get("entity_id");
  const user_id = searchParams.get("user_id");
  const action = searchParams.get("action");
  const limit = searchParams.get("limit");

  const result = await listAuditLogs({ entity_type, entity_id, user_id, action, limit });
  return NextResponse.json({ success: true, entries: result.rows });
});

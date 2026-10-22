import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getAuditLog } from "@/services/ventures/auditSecurity";

export const GET = createHandler(
  async (req, { params }) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;

    const { id } = await params;
    const log = await getAuditLog(parseInt(id));
    if (!log) {
      return NextResponse.json(
        { success: false, error: "Audit log entry not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, log });
  },
);

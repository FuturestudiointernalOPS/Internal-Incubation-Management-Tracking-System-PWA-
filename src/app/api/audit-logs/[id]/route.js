import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getAuditLog } from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req, { params }) => {
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

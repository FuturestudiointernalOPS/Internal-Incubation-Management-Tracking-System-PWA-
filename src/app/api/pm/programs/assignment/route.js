import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession, isAssignedPmForProgram } from "@/lib/auth";
import { updateProgramAssignmentColumn } from "@/models/programs";

export const PATCH = createHandler(
  { roles: ["super_admin", "program_manager", "staff"] },
  async (req) => {
    const { program_id, contact_cid, type } = await req.json();
    if (!program_id || !contact_cid) {
      return NextResponse.json(
        { success: false, error: "Program and Contact required." },
        { status: 400 },
      );
    }
    // Staff may only assign/change a program's PM/assistant when they are the
    // assigned PM of that program (PM is a function layered on Staff).
    const session = await getSession();
    if (session?.role === "staff") {
      const isPm = await isAssignedPmForProgram(program_id, session.cid);
      if (!isPm) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
    }
    const column = type === "pm" ? "assigned_pm_id" : "assigned_assistant_id";
    await updateProgramAssignmentColumn(column, contact_cid, program_id);
    return NextResponse.json({ success: true });
  },
);

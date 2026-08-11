import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const PATCH = createHandler(
  { roles: ["super_admin", "program_manager"] },
  async (req) => {
    const { program_id, contact_cid, type } = await req.json();
    if (!program_id || !contact_cid) {
      return NextResponse.json(
        { success: false, error: "Program and Contact required." },
        { status: 400 },
      );
    }
    const column = type === "pm" ? "assigned_pm_id" : "assigned_assistant_id";
    await db.execute({
      sql: `UPDATE v2_programs SET ${column} = ? WHERE id = ?`,
      args: [contact_cid, program_id],
    });
    return NextResponse.json({ success: true });
  },
);
